const flightRef = (args[0] || "").trim().toUpperCase();
if (!flightRef) {
  throw Error("Missing flightRef argument");
}

const departureTimeSeconds = Number(args[1] || "");
if (!Number.isFinite(departureTimeSeconds) || departureTimeSeconds <= 0) {
  throw Error("Missing or invalid departureTime argument");
}

if (!secrets.apiToken) {
  throw Error("Missing Cirium apiToken secret");
}

const flightMatch = flightRef.match(/^([A-Z0-9]{2,3}?)(\d{1,4}[A-Z]*)$/);
if (!flightMatch) {
  throw Error(`Unable to split flightRef into airline and flight number: ${flightRef}`);
}

const airlineCode = flightMatch[1];
const flightNumber = flightMatch[2];

const baseDateUtc = new Date(departureTimeSeconds * 1000);
if (Number.isNaN(baseDateUtc.getTime())) {
  throw Error(`Unable to parse departureTime: ${args[1]}`);
}

const makeDateString = (date) => date.toISOString().slice(0, 10);
const departureDate = makeDateString(baseDateUtc);

const readDelay = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
};

const readDate = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.dateUtc || value.dateLocal || null;
  return null;
};

const calculateDelay = (currentTime, scheduledTime) => {
  if (!currentTime || !scheduledTime) return null;
  const currentTs = Date.parse(currentTime);
  const scheduledTs = Date.parse(scheduledTime);
  if (!Number.isFinite(currentTs) || !Number.isFinite(scheduledTs)) return null;
  return Math.max(0, Math.round((currentTs - scheduledTs) / 60000));
};

const pickDelayInfo = (row) => {
  const departureGateDelay = readDelay(row?.delays?.departureGateDelayMinutes);
  if (departureGateDelay !== null) return { delayMins: departureGateDelay, source: "delays.departureGateDelayMinutes" };

  const departureRunwayDelay = readDelay(row?.delays?.departureRunwayDelayMinutes);
  if (departureRunwayDelay !== null) return { delayMins: departureRunwayDelay, source: "delays.departureRunwayDelayMinutes" };

  const arrivalGateDelay = readDelay(row?.delays?.arrivalGateDelayMinutes);
  if (arrivalGateDelay !== null) return { delayMins: arrivalGateDelay, source: "delays.arrivalGateDelayMinutes" };

  const arrivalRunwayDelay = readDelay(row?.delays?.arrivalRunwayDelayMinutes);
  if (arrivalRunwayDelay !== null) return { delayMins: arrivalRunwayDelay, source: "delays.arrivalRunwayDelayMinutes" };

  const scheduledDeparture = readDate(row?.operationalTimes?.scheduledGateDeparture) || readDate(row?.departureDate);
  const liveDeparture =
    readDate(row?.operationalTimes?.actualGateDeparture) ||
    readDate(row?.operationalTimes?.estimatedGateDeparture);
  const derivedDepartureDelay = calculateDelay(liveDeparture, scheduledDeparture);
  if (derivedDepartureDelay !== null) return { delayMins: derivedDepartureDelay, source: "derived.departure" };

  const scheduledArrival = readDate(row?.operationalTimes?.scheduledGateArrival) || readDate(row?.arrivalDate);
  const liveArrival =
    readDate(row?.operationalTimes?.actualGateArrival) ||
    readDate(row?.operationalTimes?.estimatedGateArrival);
  const derivedArrivalDelay = calculateDelay(liveArrival, scheduledArrival);
  if (derivedArrivalDelay !== null) return { delayMins: derivedArrivalDelay, source: "derived.arrival" };

  return { delayMins: null, source: "none" };
};

const url =
  `https://api.sky.cirium.com/v1/flights/status/airline/${encodeURIComponent(airlineCode)}` +
  `/flight-number/${encodeURIComponent(flightNumber)}` +
  `/departure-date/${encodeURIComponent(departureDate)}`;

const response = await Functions.makeHttpRequest({
  url,
  headers: {
    Authorization: secrets.apiToken,
    Accept: "application/json",
  },
});

if (response.error) {
  throw Error(`Cirium request failed: ${JSON.stringify(response.error)}`);
}

const rows = Array.isArray(response.data?.flightStatuses) ? response.data.flightStatuses : [];
if (!rows.length) {
  throw Error(`No flight data returned for ${flightRef} on ${departureDate}`);
}

const bestMatch = rows.reduce((best, row) => {
  const departureUtc = readDate(row?.departureDate);
  const departureTs = departureUtc ? Date.parse(departureUtc) : NaN;
  const score = Number.isFinite(departureTs)
    ? Math.abs(departureTs - (departureTimeSeconds * 1000))
    : Number.MAX_SAFE_INTEGER;

  if (!best || score < best.score) {
    return { row, score };
  }
  return best;
}, null);

const delayInfo = pickDelayInfo(bestMatch.row);
if (delayInfo.delayMins === null) {
  throw Error(`Delay field is not available yet for ${flightRef}`);
}

return Functions.encodeUint256(delayInfo.delayMins);
