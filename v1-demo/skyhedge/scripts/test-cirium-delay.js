const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function readDate(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.dateUtc || value.dateLocal || null;
  return null;
}

function readDelay(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function calculateDelay(currentTime, scheduledTime) {
  if (!currentTime || !scheduledTime) return null;
  const currentTs = Date.parse(currentTime);
  const scheduledTs = Date.parse(scheduledTime);
  if (!Number.isFinite(currentTs) || !Number.isFinite(scheduledTs)) return null;
  return Math.max(0, Math.round((currentTs - scheduledTs) / 60000));
}

function pickDelayInfo(row) {
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
}

function usage() {
  console.log("Usage:");
  console.log("  node scripts/test-cirium-delay.js <flightRef> <departureTimeUnix>");
  console.log("");
  console.log("Example:");
  console.log("  node scripts/test-cirium-delay.js TR134 1775569500");
}

async function main() {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable. Use Node.js 18 or newer.");
  }

  const flightRef = String(process.argv[2] || "").trim().toUpperCase();
  const departureTimeSeconds = Number(process.argv[3] || "");
  const apiToken = process.env.CIRIUM_API_TOKEN || "";

  if (!flightRef || !Number.isFinite(departureTimeSeconds)) {
    usage();
    throw new Error("Missing required arguments.");
  }

  if (!apiToken) {
    throw new Error("Missing CIRIUM_API_TOKEN in root .env.");
  }

  const match = flightRef.match(/^([A-Z0-9]{2,3}?)(\d{1,4}[A-Z]*)$/);
  if (!match) {
    throw new Error(`Unable to split flightRef into airline and flight number: ${flightRef}`);
  }

  const airlineCode = match[1];
  const flightNumber = match[2];
  const baseDateUtc = new Date(departureTimeSeconds * 1000);
  if (Number.isNaN(baseDateUtc.getTime())) {
    throw new Error(`Unable to parse departureTimeUnix: ${process.argv[3]}`);
  }

  const makeDateString = (date) => date.toISOString().slice(0, 10);
  const departureDate = makeDateString(baseDateUtc);

  console.log(`flightRef=${flightRef}`);
  console.log(`airlineCode=${airlineCode}`);
  console.log(`flightNumber=${flightNumber}`);
  console.log(`departureTimeUnix=${departureTimeSeconds}`);
  console.log(`departureDate(UTC)=${departureDate}`);
  console.log("");

  const url =
    `https://api.sky.cirium.com/v1/flights/status/airline/${encodeURIComponent(airlineCode)}` +
    `/flight-number/${encodeURIComponent(flightNumber)}` +
    `/departure-date/${encodeURIComponent(departureDate)}`;

  console.log(`Requesting: ${url}`);
  const response = await fetch(url, {
    headers: {
      Authorization: apiToken,
      Accept: "application/json",
    },
  });

  console.log(`HTTP ${response.status}`);
  const payload = await response.json();

  if (!response.ok || payload?.error) {
    console.log("Response error payload:");
    console.dir(payload, { depth: 6 });
    throw new Error("Cirium request did not return a usable success payload.");
  }

  const rows = Array.isArray(payload?.flightStatuses) ? payload.flightStatuses : [];
  console.log(`Rows returned: ${rows.length}`);
  if (!rows.length) {
    throw new Error("No usable flight match found for the computed UTC departure date.");
  }

  const bestMatch = rows.reduce((best, row) => {
    const departureUtc = readDate(row?.departureDate);
    const departureTs = departureUtc ? Date.parse(departureUtc) : NaN;
    const score = Number.isFinite(departureTs)
      ? Math.abs(departureTs - (departureTimeSeconds * 1000))
      : Number.MAX_SAFE_INTEGER;

    if (!best || score < best.score) {
      return { row, score, departureDate };
    }
    return best;
  }, null);

  if (!bestMatch) {
    throw new Error("No usable flight match found.");
  }

  const delayInfo = pickDelayInfo(bestMatch.row);
  console.log("Best match:");
  console.dir(
    {
      departureDateUsed: bestMatch.departureDate,
      carrierFsCode: bestMatch.row?.carrierFsCode,
      flightNumber: bestMatch.row?.flightNumber,
      status: bestMatch.row?.status,
      departureDate: bestMatch.row?.departureDate,
      arrivalDate: bestMatch.row?.arrivalDate,
      delays: bestMatch.row?.delays || {},
      selectedDelaySource: delayInfo.source,
      delayMins: delayInfo.delayMins,
    },
    { depth: 6 }
  );

  if (delayInfo.delayMins === null) {
    throw new Error("Request succeeded, but no usable delay field is available yet.");
  }
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
