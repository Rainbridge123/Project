const flightRef = (args[0] || "").trim().toUpperCase();
if (!flightRef) {
  throw Error("Missing flightRef argument");
}

if (!secrets.apiKey) {
  throw Error("Missing AviationStack apiKey secret");
}

const url =
  `https://api.aviationstack.com/v1/flights?access_key=${secrets.apiKey}` +
  `&flight_iata=${encodeURIComponent(flightRef)}&limit=1`;

const response = await Functions.makeHttpRequest({ url });
if (response.error) {
  throw Error(`AviationStack request failed: ${JSON.stringify(response.error)}`);
}

const rows = Array.isArray(response.data?.data) ? response.data.data : [];
if (!rows.length) {
  throw Error(`No flight data returned for ${flightRef}`);
}

const normalizedFlightRef = flightRef.toUpperCase();
const row =
  rows.find((item) => String(item?.flight?.iata || item?.flightRef || "").toUpperCase() === normalizedFlightRef) ||
  rows[0];

const readDelay = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
};

const departureDelay = readDelay(row?.departure?.delay ?? row?.departure_delay_mins);
const arrivalDelay = readDelay(row?.arrival?.delay ?? row?.arrival_delay_mins);
const delayMins = departureDelay ?? arrivalDelay;

if (delayMins === null) {
  throw Error(`Delay field is not available yet for ${flightRef}`);
}

return Functions.encodeUint256(delayMins);
