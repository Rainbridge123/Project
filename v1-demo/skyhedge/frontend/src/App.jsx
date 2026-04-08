import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ACTIVE_NETWORK_KEY, ACTIVE_NETWORK_LABEL, CONTRACT_ADDRESS, ABI, COORDINATOR_ABI, STATUS, READ_RPC_URL, DEPLOY_BLOCK, EXPECTED_CHAIN_ID, CIRIUM_API_TOKEN, CIRIUM_BASE_URL, SYNDICATE_MANAGER_ADDRESS, SYNDICATE_MANAGER_ABI, RISK_VAULT_ABI } from "./config";

const hasConfiguredAddress = Boolean(CONTRACT_ADDRESS) && ethers.isAddress(CONTRACT_ADDRESS);
const readProvider = READ_RPC_URL ? new ethers.JsonRpcProvider(READ_RPC_URL) : null;
const readOnlyContract = readProvider && hasConfiguredAddress ? new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider) : null;
const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
function pad2(value) {
  return String(value).padStart(2, "0");
}
function dateInputDaysFromNow(offsetDays = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function shiftDateInputValue(dateInputValue, offsetDays) {
  const d = new Date(`${dateInputValue}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateInputValue;
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
const MIN_LOOKUP_DATE = dateInputDaysFromNow(0);
const DEFAULT_FLIGHT_LOOKUP = {
  flightRef: "TR134",
  airline: "Scoot",
  flight_date: "2026-04-07",
  flight_status: "scheduled",
  departure_airport: "Singapore Changi",
  departure_timezone: "Asia/Singapore",
  departure_iata: "SIN",
  departure_terminal: "1",
  departure_scheduled: "2026-04-07T19:05:00.000",
  departure_estimated: "2026-04-07T19:05:00.000",
  departure_actual: null,
  departure_delay_mins: null,
  arrival_airport: "Xi'an Xianyang International Airport",
  arrival_timezone: "Asia/Shanghai",
  arrival_iata: "XIY",
  arrival_terminal: "",
  arrival_scheduled: "2026-04-08T00:40:00.000",
  arrival_estimated: null,
  arrival_actual: null,
  arrival_delay_mins: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// ✈️ 乘客专属 Dashboard：蓝色科技感
// ─────────────────────────────────────────────────────────────────────────────
function PassengerView({ sharedProps }) {
  return (
    <div style={{ height: "100%", padding: "24px", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", borderRadius: "24px", border: "1px solid #4fc3f733", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <h2 style={{ color: "#4fc3f7", fontSize: "28px", marginBottom: "20px" }}>✈️ Passenger Portal</h2>
      <div style={{ background: "#ffffff05", padding: "20px", borderRadius: "16px", flex: 1, minHeight: 0, overflowY: "auto" }}>
        <PassengerTab {...sharedProps} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏦 保险商专属 Dashboard：暗黑金融风
// ─────────────────────────────────────────────────────────────────────────────
function UnderwriterView({ sharedProps, roleKey }) {
  return (
    <div style={{ height: "100%", padding: "24px", background: "#0d0f14", border: "2px solid #34d399", borderRadius: "12px", boxShadow: "0 0 20px #34d39922", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <h2 style={{ color: "#34d399", fontFamily: "monospace", textTransform: "uppercase" }}>🏦 Underwriter Terminal</h2>
      <p style={{ color: "#34d399", fontSize: "12px", marginBottom: "20px" }}>[SECURE CONNECTION ACTIVE]</p>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <UnderwriterTab {...sharedProps} roleKey={roleKey} />
      </div>
    </div>
  );
}

function SyndicateView({ sharedProps }) {
  return (
    <div style={{ height: "100%", padding: "22px", background: "radial-gradient(circle at top left, #3b1f11 0%, #16181d 42%, #0b0f17 100%)", border: "1px solid #fb923c44", borderRadius: "24px", boxShadow: "0 18px 50px #00000033", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      <div style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ color: "#fb923c", fontSize: "30px", marginBottom: 8 }}>🧩 Risk NFT Marketplace</h2>
          <div style={{ color: "#fed7aa", fontSize: 13, maxWidth: 760, lineHeight: 1.6 }}>
            List one Risk NFT for shared exposure, let other users subscribe to fixed shares, and manage the post-settlement claim flow from one focused workspace.
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 6 }}>
        <SyndicateTab {...sharedProps} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔮 预言机专属 Dashboard：金色权威感
// ─────────────────────────────────────────────────────────────────────────────
function ResolverView({ sharedProps }) {
  return (
    <div style={{ height: "100%", display: "flex", justifyContent: "center", padding: "16px" }}>
      <div style={{ width: "100%", background: "#1a1a1a", border: "3px solid #f59e0b", borderRadius: "40px", padding: "28px", textAlign: "center", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <h2 style={{ color: "#f59e0b", fontSize: "32px", marginBottom: "20px" }}>🔮 Oracle Node</h2>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <ResolverTab {...sharedProps} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers (保持原样)
// ─────────────────────────────────────────────────────────────────────────────
const HARDHAT_DEFAULTS = {
  passenger:    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  underwriter1: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  underwriter2: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  resolver:     "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  thirdParty:   "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
};
const ROLE_META = {
  passenger:    { label: "✈️ Passenger",     color: "#4fc3f7" },
  underwriter:  { label: "🏦 Underwriter",   color: "#34d399" },
  syndicate:    { label: "🧩 Risk NFT Marketplace", color: "#fb923c" },
  underwriter1: { label: "🏦 Underwriter 1", color: "#34d399" },
  underwriter2: { label: "🏦 Underwriter 2", color: "#a78bfa" },
  resolver:     { label: "🔮 Resolver",       color: "#f59e0b" },
  thirdParty:   { label: "👤 Third Party",    color: "#f472b6" },
};

function addrToRoleKey(addr, roleAddresses) {
  if (!addr) return null;
  for (const [role, a] of Object.entries(roleAddresses)) {
    if (a?.toLowerCase() === addr.toLowerCase()) return role;
  }
  return null;
}
function addrDisplay(addr, roleAddresses) {
  if (!addr || addr === ethers.ZeroAddress) return "—";
  const role = addrToRoleKey(addr, roleAddresses);
  const short = addr.slice(0, 6) + "…" + addr.slice(-4);
  return role ? `${ROLE_META[role].label} (${short})` : short;
}
function derivedStatus(policy) {
  if (!policy || policy.passenger === ethers.ZeroAddress) return "UNKNOWN";
  const s = Number(policy.status);
  const now = Math.floor(Date.now() / 1000);
  if (s === 0) {
    if (policy.bestUnderwriter === ethers.ZeroAddress && now >= Number(policy.expiry)) return "UNBID_EXPIRED";
    return now < Number(policy.auctionEnd) ? "BIDDING_OPEN" : "BIDDING_ENDED";
  }
  if (s === 1) return "ACTIVE";
  if (s === 2) return "PAID";
  if (s === 3) return policy.policyNFTId > 0n ? "RESOLVED_ON_TIME" : "REFUNDED_UNBID";
  return "UNKNOWN";
}
const DERIVED_META = {
  BIDDING_OPEN:  { label: "BIDDING — OPEN",  color: "#f59e0b", desc: "Auction open. Underwriters can place bids now." },
  BIDDING_ENDED: { label: "BIDDING — ENDED", color: "#ef4444", desc: "Auction closed. Winning underwriter must finalize." },
  UNBID_EXPIRED: { label: "Waiting Refund",  color: "#fb7185", desc: "No bids were placed. Passenger refund is still pending." },
  ACTIVE:        { label: "ACTIVE",           color: "#3b82f6", desc: "Collateral locked. Awaiting oracle resolution." },
  PAID:          { label: "Payout Paid",      color: "#22c55e", desc: "Flight delayed. Payout sent to Policy NFT holder." },
  REFUNDED_UNBID:{ label: "Refunded",         color: "#94a3b8", desc: "Unbid policy expired and the passenger premium has been refunded." },
  RESOLVED_ON_TIME: { label: "Collateral Returned", color: "#38bdf8", desc: "Flight was on time. Collateral returned to the Risk NFT holder." },
  UNKNOWN:       { label: "UNKNOWN",          color: "#475569", desc: "" },
};

function parseError(e) {
  const raw = JSON.stringify(e);
  const m1 = raw.match(/reverted with reason string '([^']+)'/);
  if (m1) return m1[1];
  if (e.reason) return e.reason;
  const m2 = (e.message || "").match(/execution reverted: (.+?)(?:"|$)/);
  if (m2) return m2[1];
  if ((e.message || "").includes("reading 'then'")) return "Frontend could not read the created policy ID. Check that MetaMask is on the correct network and frontend/src/config.js matches the deployed contract address and ABI.";
  if (e.code === 4001 || (e.message || "").includes("rejected")) return "Transaction rejected by user.";
  return e.shortMessage || e.message || "Unknown error";
}

function toBytes32(str) { return ethers.encodeBytes32String(str.slice(0, 31)); }
function fromBytes32(hex) { try { return ethers.decodeBytes32String(hex); } catch { return hex; } }
function shortAddr(addr) { return addr ? addr.slice(0, 6) + "…" + addr.slice(-4) : "—"; }
function upperFlightRef(value) { return (value || "").trim().toUpperCase(); }
function normalizeAirlineCode(value) { return (value || "").trim().toUpperCase(); }
function normalizeFlightNumber(value) { return (value || "").trim().toUpperCase(); }
function buildFlightRef(airlineCode = "", flightNumber = "") {
  return `${normalizeAirlineCode(airlineCode)}${normalizeFlightNumber(flightNumber)}`;
}
function splitFlightRef(flightRef = "") {
  const normalized = upperFlightRef(flightRef);
  const match = normalized.match(/^([A-Z0-9]{2,3}?)(\d{1,4}[A-Z]*)$/);
  if (!match) {
    return { airlineCode: "", flightNumber: normalized };
  }
  return {
    airlineCode: match[1],
    flightNumber: match[2],
  };
}
function buildFlightLookupKey({ airlineCode = "", flightNumber = "", departureDate = "" }) {
  return `${normalizeAirlineCode(airlineCode)}|${normalizeFlightNumber(flightNumber)}|${departureDate}`;
}
function unixTsToDateInputValue(ts) {
  const parsed = Number(ts);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed * 1000).toISOString().slice(0, 10);
}
function getCoordinatorContract(contract, coordinatorAddress) {
  if (!contract || !coordinatorAddress || !ethers.isAddress(coordinatorAddress)) return null;
  return new ethers.Contract(coordinatorAddress, COORDINATOR_ABI, contract.runner);
}
function getSyndicateManagerContract(contract, managerAddress) {
  if (!contract || !managerAddress || !ethers.isAddress(managerAddress)) return null;
  return new ethers.Contract(managerAddress, SYNDICATE_MANAGER_ABI, contract.runner);
}
function getRiskVaultContract(contract, vaultAddress) {
  if (!contract || !vaultAddress || !ethers.isAddress(vaultAddress)) return null;
  return new ethers.Contract(vaultAddress, RISK_VAULT_ABI, contract.runner);
}
function decodeCoordinatorDelay(responseBytes) {
  if (!responseBytes || responseBytes === "0x") return null;
  try {
    const [delay] = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], responseBytes);
    return Number(delay);
  } catch {
    return null;
  }
}
function decodeCoordinatorError(errorBytes) {
  if (!errorBytes || errorBytes === "0x") return "";
  try {
    return ethers.toUtf8String(errorBytes);
  } catch {
    return errorBytes;
  }
}
function extractIsoWallTimeParts(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || "0"),
  };
}
function toDatetimeLocalValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function apiTimeToDatetimeLocalValue(value) {
  const parts = extractIsoWallTimeParts(value);
  if (!parts) return toDatetimeLocalValue(value);
  const pad = n => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
function apiTimeToBrowserDatetimeLocalValue(value, timeZone) {
  const apiWallTime = apiTimeToDatetimeLocalValue(value);
  if (!apiWallTime) return "";
  const ts = zonedWallTimeToTs(apiWallTime, timeZone);
  return Number.isFinite(ts) ? toDatetimeLocalValue(ts * 1000) : apiWallTime;
}
function buildManualFlightInfo(flightRef = "", departureTime = "") {
  return {
    flightRef: upperFlightRef(flightRef),
    airline: "Manual entry",
    flight_date: departureTime ? String(departureTime).split("T")[0] : "",
    flight_status: "manual",
    departure_airport: "Custom input",
    departure_timezone: BROWSER_TIMEZONE,
    departure_iata: "",
    departure_terminal: "",
    departure_scheduled: departureTime || null,
    departure_estimated: departureTime || null,
    departure_actual: null,
    departure_delay_mins: null,
    arrival_airport: "",
    arrival_timezone: "",
    arrival_iata: "",
    arrival_terminal: "",
    arrival_scheduled: null,
    arrival_estimated: null,
    arrival_actual: null,
    arrival_delay_mins: null,
  };
}
function zonedWallTimeToTs(dtStr, timeZone) {
  if (!timeZone) return localToTs(dtStr);
  const parts = extractIsoWallTimeParts(dtStr);
  if (!parts) return localToTs(dtStr);
  const desiredUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const getObservedUtcMs = (ms) => {
    const entries = Object.fromEntries(
      formatter
        .formatToParts(new Date(ms))
        .filter(part => part.type !== "literal")
        .map(part => [part.type, part.value])
    );
    return Date.UTC(
      Number(entries.year),
      Number(entries.month) - 1,
      Number(entries.day),
      Number(entries.hour),
      Number(entries.minute),
      Number(entries.second)
    );
  };
  const firstPass = desiredUtcMs - (getObservedUtcMs(desiredUtcMs) - desiredUtcMs);
  const secondPass = firstPass - (getObservedUtcMs(firstPass) - desiredUtcMs);
  return Math.floor(secondPass / 1000);
}
function formatApiTimeWithTimezone(value, timeZone) {
  const parts = extractIsoWallTimeParts(value);
  if (!parts) return "—";
  const pad = n => String(n).padStart(2, "0");
  const base = `${parts.year}/${pad(parts.month)}/${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  return timeZone ? `${base} (${timeZone})` : base;
}
function pickDepartureTime(flight) {
  return flight?.departure_estimated || flight?.departure_scheduled || flight?.departure_actual || "";
}
function normalizeFlightStatus(value) {
  return readTextValue(value, "").trim().toLowerCase();
}
function clampExpiryValue(expiryValue, departureValue) {
  if (!departureValue) return expiryValue;
  if (!expiryValue) return departureValue;
  return localToTs(expiryValue) > localToTs(departureValue) ? departureValue : expiryValue;
}
function readTextValue(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    if (typeof value.name === "string" && value.name) return value.name;
    if (typeof value.iata === "string" && value.iata) return value.iata;
    if (typeof value.icao === "string" && value.icao) return value.icao;
  }
  return fallback;
}
function findAppendixEntry(items, code) {
  const normalizedCode = normalizeAirlineCode(code);
  if (!normalizedCode || !Array.isArray(items)) return null;
  return items.find((item) => (
    normalizeAirlineCode(item?.fs) === normalizedCode ||
    normalizeAirlineCode(item?.iata) === normalizedCode ||
    normalizeAirlineCode(item?.icao) === normalizedCode ||
    normalizeAirlineCode(item?.faa) === normalizedCode
  )) || null;
}
function pickCiriumDateLocal(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.dateLocal || value.dateUtc || null;
  return null;
}
function calculateDelayMinutes(currentTime, scheduledTime) {
  if (!currentTime || !scheduledTime) return null;
  const currentTs = Date.parse(currentTime);
  const scheduledTs = Date.parse(scheduledTime);
  if (!Number.isFinite(currentTs) || !Number.isFinite(scheduledTs)) return null;
  return Math.max(0, Math.round((currentTs - scheduledTs) / 60000));
}
const CIRIUM_STATUS_MAP = {
  A: "active",
  C: "cancelled",
  D: "diverted",
  DN: "pending_data",
  L: "landed",
  NO: "not_operational",
  R: "redirected",
  S: "scheduled",
  U: "unknown",
};
function mapCiriumStatus(statusCode) {
  return CIRIUM_STATUS_MAP[normalizeAirlineCode(statusCode)] || "unknown";
}
function pickCiriumDelay(explicitValues, liveTime, scheduledTime) {
  for (const value of explicitValues) {
    const parsed = readDelayMins(value);
    if (parsed !== null) return parsed;
  }
  return calculateDelayMinutes(liveTime, scheduledTime);
}
function normalizeFlightLookupResponse(payload, fallbackQuery = {}) {
  const raw = Array.isArray(payload?.flightStatuses) ? payload.flightStatuses[0] : null;
  if (!raw) return null;
  const airline = findAppendixEntry(payload?.appendix?.airlines, raw.carrierFsCode || fallbackQuery.airlineCode);
  const departureAirport = findAppendixEntry(payload?.appendix?.airports, raw.departureAirportFsCode);
  const arrivalAirport = findAppendixEntry(payload?.appendix?.airports, raw.arrivalAirportFsCode);
  const departureScheduled =
    pickCiriumDateLocal(raw?.operationalTimes?.scheduledGateDeparture) ||
    pickCiriumDateLocal(raw?.operationalTimes?.publishedDeparture) ||
    pickCiriumDateLocal(raw?.departureDate);
  const departureEstimated =
    pickCiriumDateLocal(raw?.operationalTimes?.estimatedGateDeparture) ||
    pickCiriumDateLocal(raw?.operationalTimes?.estimatedRunwayDeparture);
  const departureActual =
    pickCiriumDateLocal(raw?.operationalTimes?.actualGateDeparture) ||
    pickCiriumDateLocal(raw?.operationalTimes?.actualRunwayDeparture);
  const arrivalScheduled =
    pickCiriumDateLocal(raw?.operationalTimes?.scheduledGateArrival) ||
    pickCiriumDateLocal(raw?.operationalTimes?.publishedArrival) ||
    pickCiriumDateLocal(raw?.arrivalDate);
  const arrivalEstimated =
    pickCiriumDateLocal(raw?.operationalTimes?.estimatedGateArrival) ||
    pickCiriumDateLocal(raw?.operationalTimes?.estimatedRunwayArrival);
  const arrivalActual =
    pickCiriumDateLocal(raw?.operationalTimes?.actualGateArrival) ||
    pickCiriumDateLocal(raw?.operationalTimes?.actualRunwayArrival);
  const airlineCode = airline?.iata || airline?.fs || fallbackQuery.airlineCode || raw.carrierFsCode || "";
  const flightNumber = raw.flightNumber || fallbackQuery.flightNumber || "";
  const normalized = {
    flightRef: upperFlightRef(buildFlightRef(airlineCode, flightNumber)),
    airline: readTextValue(airline?.name || airlineCode, "Unknown airline"),
    flight_date: readTextValue(payload?.request?.date?.interpreted || departureScheduled?.split("T")[0] || fallbackQuery.departureDate, ""),
    flight_status: mapCiriumStatus(raw.status),
    departure_airport: readTextValue(departureAirport?.name || raw.departureAirportFsCode, ""),
    departure_timezone: readTextValue(departureAirport?.timeZoneRegionName, ""),
    departure_iata: readTextValue(departureAirport?.iata || raw.departureAirportFsCode, ""),
    departure_terminal: readTextValue(raw?.airportResources?.departureTerminal, ""),
    departure_scheduled: departureScheduled,
    departure_estimated: departureEstimated,
    departure_actual: departureActual,
    departure_delay_mins: pickCiriumDelay(
      [raw?.delays?.departureGateDelayMinutes, raw?.delays?.departureRunwayDelayMinutes],
      departureActual || departureEstimated,
      departureScheduled
    ),
    arrival_airport: readTextValue(arrivalAirport?.name || raw.arrivalAirportFsCode, ""),
    arrival_timezone: readTextValue(arrivalAirport?.timeZoneRegionName, ""),
    arrival_iata: readTextValue(arrivalAirport?.iata || raw.arrivalAirportFsCode, ""),
    arrival_terminal: readTextValue(raw?.airportResources?.arrivalTerminal, ""),
    arrival_scheduled: arrivalScheduled,
    arrival_estimated: arrivalEstimated,
    arrival_actual: arrivalActual,
    arrival_delay_mins: pickCiriumDelay(
      [raw?.delays?.arrivalGateDelayMinutes, raw?.delays?.arrivalRunwayDelayMinutes],
      arrivalActual || arrivalEstimated,
      arrivalScheduled
    ),
  };
  return normalized.flightRef ? normalized : null;
}
function readDelayMins(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}
function pickFlightDelayDetails(flightInfo) {
  const departureDelay = readDelayMins(flightInfo?.departure_delay_mins);
  if (departureDelay !== null) return { delayMins: departureDelay, source: "departure.delay" };
  const arrivalDelay = readDelayMins(flightInfo?.arrival_delay_mins);
  if (arrivalDelay !== null) return { delayMins: arrivalDelay, source: "arrival.delay" };
  return { delayMins: null, source: "none" };
}
async function fetchFlightLookupData(query) {
  const { airlineCode = "", flightNumber = "", departureDate = "" } = typeof query === "string"
    ? { ...splitFlightRef(query), departureDate: MIN_LOOKUP_DATE }
    : query || {};
  const normalizedAirlineCode = normalizeAirlineCode(airlineCode);
  const normalizedFlightNumber = normalizeFlightNumber(flightNumber);
  if (!normalizedAirlineCode) throw new Error("Airline code is required.");
  if (!normalizedFlightNumber) throw new Error("Flight number is required.");
  if (!departureDate) throw new Error("Departure date is required.");
  if (!CIRIUM_API_TOKEN) throw new Error("Missing REACT_APP_CIRIUM_API_TOKEN in frontend/.env.");

  const response = await fetch(
    `${CIRIUM_BASE_URL}/flights/status/airline/${encodeURIComponent(normalizedAirlineCode)}/flight-number/${encodeURIComponent(normalizedFlightNumber)}/departure-date/${encodeURIComponent(departureDate)}`,
    {
      headers: {
        Authorization: CIRIUM_API_TOKEN,
        Accept: "application/json",
      },
    }
  );
  if (!response.ok) {
    throw new Error(`Cirium request failed with ${response.status}.`);
  }
  const payload = await response.json();
  if (payload?.error?.errorMessage || payload?.error?.httpStatusCode) {
    throw new Error(payload.error.errorMessage || `Cirium request failed with ${payload.error.httpStatusCode}.`);
  }
  const normalizedFlight = normalizeFlightLookupResponse(payload, {
    airlineCode: normalizedAirlineCode,
    flightNumber: normalizedFlightNumber,
    departureDate,
  });
  if (!normalizedFlight) {
    throw new Error(`No flight data found for ${buildFlightRef(normalizedAirlineCode, normalizedFlightNumber)} on ${departureDate}.`);
  }
  return normalizedFlight;
}
function fmtEth(wei) {
  if (wei === undefined || wei === null) return "—";
  const n = parseFloat(ethers.formatEther(wei));
  return n.toFixed(4) + " ETH";
}
function nowPlusSeconds(s) {
  const d = new Date(Date.now() + s * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToTs(dtStr) { return Math.floor(new Date(dtStr).getTime() / 1000); }
function tsToLocal(ts) { return new Date(Number(ts) * 1000).toLocaleString(); }
function settlementReadyTs(policy) {
  if (!policy) return 0;
  return Number(policy.departureTime) + (Number(policy.delayThreshold) * 60);
}
function isSettlementWindowOpen(policy, nowTs = Math.floor(Date.now() / 1000)) {
  if (!policy) return false;
  return nowTs >= settlementReadyTs(policy);
}
function calcGas(tx, rcpt) {
  const price = tx.gasPrice ?? tx.maxFeePerGas ?? 0n;
  return fmtEth(rcpt.gasUsed * price);
}
function parsePolicyIdValue(value) {
  try {
    return String(value);
  } catch {
    return "";
  }
}
function subtractBigInts(a, b) {
  const left = BigInt(a ?? 0);
  const right = BigInt(b ?? 0);
  return left > right ? left - right : 0n;
}
function safeParseEther(value) {
  try {
    return ethers.parseEther(String(value ?? "0").trim() || "0");
  } catch {
    return null;
  }
}
function sumPolicyPayouts(entries) {
  return entries.reduce((total, entry) => total + BigInt(entry?.policy?.fixedPayout ?? 0), 0n);
}
function buildFallbackFinalTransfer(ds, policy, roleAddresses) {
  if (!policy) return "—";
  if (ds === "PAID") {
    return `${fmtEth(policy.fixedPayout)} -> Policy NFT holder`;
  }
  if (ds === "RESOLVED_ON_TIME") {
    return `${fmtEth(policy.fixedPayout)} -> Risk NFT holder`;
  }
  if (ds === "REFUNDED_UNBID") {
    return `${fmtEth(policy.maxPremium)} -> ${addrDisplay(policy.passenger, roleAddresses)}`;
  }
  if (ds === "UNBID_EXPIRED") {
    return `${fmtEth(policy.maxPremium)} -> ${addrDisplay(policy.passenger, roleAddresses)} (pending)`;
  }
  return "—";
}
function describeSettlementOutcome(ds, resolutionState, policy) {
  if (ds === "PAID") return "Delayed flight";
  if (ds === "RESOLVED_ON_TIME") return "On-time flight";
  if (ds === "REFUNDED_UNBID") return "Unbid policy expired";
  if (ds === "ACTIVE") return "Awaiting settlement.";
  if (ds === "UNBID_EXPIRED") return "Ready for passenger refund.";
  return "Settlement details unavailable.";
}
function buildTxLog(role, action) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    action,
    timestamp: new Date().toLocaleString(),
  };
}

const inputStyle = { background: "#111318", border: "1px solid #2d3445", borderRadius: 6, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, fontFamily: "monospace", width: "100%", outline: "none" };
const btnStyle = (color, extra = {}) => ({ background: color + "22", border: `1px solid ${color}55`, borderRadius: 6, color, padding: "8px 18px", fontSize: 13, fontFamily: "monospace", cursor: "pointer", fontWeight: 600, ...extra });
const disabledBtnStyle = { background: "#1a1e2a", border: "1px solid #3d4455", borderRadius: 6, color: "#94a3b8", padding: "8px 18px", fontSize: 13, fontFamily: "monospace", cursor: "not-allowed", fontWeight: 600 };
const CLR = { label: "#cbd5e1", value: "#f1f5f9", dim: "#94a3b8", head: "#f1f5f9" };
const STATUS_PRIORITY = { ACTIVE: 0, UNBID_EXPIRED: 1, BIDDING_OPEN: 2, BIDDING_ENDED: 3, PAID: 4, RESOLVED_ON_TIME: 5, REFUNDED_UNBID: 6, UNKNOWN: 7 };
const RIGHT_PANEL_STATUS_GROUPS = [
  { key: "ACTIVE", title: "Active" },
  { key: "BIDDING_OPEN", title: "Bidding Open" },
  { key: "BIDDING_ENDED", title: "Bidding Ended" },
  { key: "RESOLVED", title: "Resolved" },
  { key: "UNKNOWN", title: "Other" },
  { key: "REFUND", title: "Refund" },
];
function rightPanelGroupKey(ds) {
  if (ds === "PAID" || ds === "RESOLVED_ON_TIME") return "RESOLVED";
  if (ds === "UNBID_EXPIRED" || ds === "REFUNDED_UNBID") return "REFUND";
  return ds;
}

function DerivedStatusBadge({ ds }) {
  const m = DERIVED_META[ds] ?? DERIVED_META.UNKNOWN;
  return <span style={{ background: m.color + "22", color: m.color, border: `1px solid ${m.color}55`, borderRadius: 4, padding: "3px 10px", fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>{m.label}</span>;
}

function AccountRoleBanner({ account, mode, resolverAccount }) {
  if (!account) return null;
  const meta = ROLE_META[mode] ?? ROLE_META.passenger;
  if (mode !== "resolver" || resolverAccount) {
    return (
      <div style={{ marginBottom: 16, padding: "10px 14px", background: meta.color + "11", border: `1px solid ${meta.color}44`, borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>Using {meta.label} Mode</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: CLR.dim }}>{shortAddr(account)}</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 16, padding: "12px 14px", background: "#7c1d1d22", border: "1px solid #ef444466", borderRadius: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#f87171", marginBottom: 4 }}>⚠️ Resolver access required</div>
      <div style={{ fontSize: 13, color: CLR.label }}>This mode requires the wallet configured as the resolver in the contract.</div>
    </div>
  );
}

function Log({ msg, err }) {
  if (!msg && !err) return null;
  return <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 6, background: err ? "#7f1d1d33" : "#14532d33", border: `1px solid ${err ? "#ef4444" : "#22c55e"}55`, color: err ? "#fca5a5" : "#86efac", fontSize: 13, fontFamily: "monospace" }}>{err ? "❌ " : "✅ "}{msg || err}</div>;
}

function PolicyCard({ policy, policyId, roleAddresses }) {
  if (!policy || policy.passenger === ethers.ZeroAddress) return null;
  const ds = derivedStatus(policy);
  const dm = DERIVED_META[ds];
  const rows = [["Flight", fromBytes32(policy.flightRef)], ["Fixed Payout", fmtEth(policy.fixedPayout)], ["Threshold", `${policy.delayThreshold} min`], ["Auction Ends", tsToLocal(policy.auctionEnd)], ["Max Premium", fmtEth(policy.maxPremium)], ["Best Premium", (!policy.maxPremium || policy.bestPremium === policy.maxPremium) ? "(no bids yet)" : fmtEth(policy.bestPremium)], ["Best UW", addrDisplay(policy.bestUnderwriter, roleAddresses)], ["Policy NFT ID", policy.policyNFTId > 0n ? String(policy.policyNFTId) : "(not minted)"], ["Risk NFT ID", policy.riskNFTId > 0n ? String(policy.riskNFTId) : "(not minted)"]];
  return (
    <div style={{ background: "#1a1e2a", border: `1px solid ${dm.color}44`, borderRadius: 8, padding: "14px 18px", marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: CLR.head, fontSize: 13, fontFamily: "monospace", fontWeight: 600 }}>Policy #{policyId}</span>
        <DerivedStatusBadge ds={ds} />
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>{rows.map(([k, v]) => (<tr key={k}><td style={{ color: CLR.label, paddingRight: 12, paddingBottom: 5, whiteSpace: "nowrap" }}>{k}</td><td style={{ color: CLR.value, fontFamily: "monospace", paddingBottom: 5 }}>{v}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

function sortPolicyEntries(entries) {
  return [...entries].sort((a, b) => {
    const statusGap = (STATUS_PRIORITY[a.ds] ?? 99) - (STATUS_PRIORITY[b.ds] ?? 99);
    if (statusGap !== 0) return statusGap;
    return Number(b.id) - Number(a.id);
  });
}

function groupPolicyEntriesByStatus(entries) {
  const grouped = new Map(RIGHT_PANEL_STATUS_GROUPS.map(group => [group.key, []]));
  for (const entry of entries) {
    const groupKey = rightPanelGroupKey(entry.ds);
    const key = grouped.has(groupKey) ? groupKey : "UNKNOWN";
    grouped.get(key).push(entry);
  }
  return RIGHT_PANEL_STATUS_GROUPS
    .map(group => ({ ...group, entries: grouped.get(group.key) ?? [] }))
    .filter(group => group.entries.length > 0);
}

function PolicySelectionList({
  policies,
  selectedPolicyId,
  onSelect,
  roleAddresses,
  isLoading,
  onRefresh,
  accentColor = "#34d399",
  title = "Available Policies",
  subtitle = "Click any policy below to load it directly.",
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const normalizedSearchTerm = upperFlightRef(searchTerm);
  const visiblePolicies = policies.filter(({ id, policy }) => {
    if (!normalizedSearchTerm) return true;
    const policyIdMatches = String(id).includes(normalizedSearchTerm);
    const flightRefMatches = upperFlightRef(fromBytes32(policy.flightRef)).includes(normalizedSearchTerm);
    return policyIdMatches || flightRefMatches;
  });

  return (
    <div style={{ marginBottom: 16, padding: "14px 16px", background: "#111318", borderRadius: 8, border: "1px solid #2d3445" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ color: accentColor, fontSize: 13, fontWeight: 700, fontFamily: "monospace", textTransform: "uppercase" }}>{title}</div>
          <div style={{ color: CLR.dim, fontSize: 12 }}>{subtitle}</div>
        </div>
        <button onClick={onRefresh} style={btnStyle(accentColor)} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Search Policy ID or Flight Number"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={inputStyle}
        />
      </div>
      {!visiblePolicies.length ? (
        <div style={{ color: CLR.dim, fontSize: 13, padding: "10px 0" }}>
          {isLoading ? "Loading policies from chain..." : policies.length ? "No matching policy ID or flight number found." : "No policies found yet."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10, maxHeight: "34vh", overflowY: "auto", paddingRight: 4 }}>
          {visiblePolicies.map(({ id, policy }) => {
            const ds = derivedStatus(policy);
            const isSelected = String(selectedPolicyId) === String(id);
            const bestPremium = (!policy.maxPremium || policy.bestPremium === policy.maxPremium) ? "(no bids yet)" : fmtEth(policy.bestPremium);
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                style={{
                  background: isSelected ? accentColor + "18" : "#0d0f14",
                  border: `1px solid ${isSelected ? accentColor + "88" : "#253041"}`,
                  borderRadius: 8,
                  padding: "12px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <span style={{ color: "#f8fafc", fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>Policy #{id}</span>
                  <DerivedStatusBadge ds={ds} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: CLR.dim }}>Flight:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fromBytes32(policy.flightRef)}</span></div>
                  <div><span style={{ color: CLR.dim }}>Passenger:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{shortAddr(policy.passenger)}</span></div>
                  <div><span style={{ color: CLR.dim }}>Best Premium:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{bestPremium}</span></div>
                  <div><span style={{ color: CLR.dim }}>Best UW:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{addrDisplay(policy.bestUnderwriter, roleAddresses)}</span></div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Tabs (PassengerTab, UnderwriterTab, ResolverTab - 逻辑保持原样)
// ─────────────────────────────────────────────────────────────────────────────
function PassengerTab({ contract, readContract, account, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh }) {
  const defaultDepartureTime = apiTimeToBrowserDatetimeLocalValue(pickDepartureTime(DEFAULT_FLIGHT_LOOKUP), DEFAULT_FLIGHT_LOOKUP.departure_timezone) || nowPlusSeconds(3600);
  const defaultLookupQuery = {
    airlineCode: "",
    flightNumber: "",
    departureDate: "",
  };
  const [form, setForm] = useState({ flightRef: DEFAULT_FLIGHT_LOOKUP.flightRef, departureTime: defaultDepartureTime, delayThreshold: "60", fixedPayout: "0.5", maxPremium: "0.05", auctionEnd: nowPlusSeconds(120), expiry: defaultDepartureTime });
  const [log, setLog] = useState({ msg: "", err: "" });
  const [policyId, setPolicyId] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [tForm, setTForm] = useState({ to: "", nftId: "" });
  const [tLog, setTLog] = useState({ msg: "", err: "" });
  const [flightQuery, setFlightQuery] = useState(defaultLookupQuery);
  const [flightInfo, setFlightInfo] = useState(DEFAULT_FLIGHT_LOOKUP);
  const [isManualFlightEntry, setIsManualFlightEntry] = useState(false);
  const [flightCache, setFlightCache] = useState({});
  const [flightLookupLog, setFlightLookupLog] = useState({ msg: "", err: "" });
  const [isFlightLookupLoading, setIsFlightLookupLoading] = useState(false);
  const normalizedFlightStatus = normalizeFlightStatus(flightInfo.flight_status);
  const canCreatePolicy = isManualFlightEntry || normalizedFlightStatus === "scheduled";
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const setFlightQueryField = (key) => (e) => {
    const rawValue = e.target.value;
    setFlightQuery((current) => ({
      ...current,
      [key]: key === "airlineCode"
        ? normalizeAirlineCode(rawValue)
        : key === "flightNumber"
          ? normalizeFlightNumber(rawValue)
          : rawValue,
    }));
  };
  const passengerFields = [
    { key: "flightRef", label: "Flight Ref", type: "text", editable: isManualFlightEntry },
    { key: "departureTime", label: `Departure Time (${BROWSER_TIMEZONE})`, type: "datetime-local", editable: isManualFlightEntry },
    { key: "delayThreshold", label: "Delay Threshold", type: "text" },
    { key: "fixedPayout", label: "Fixed Payout", type: "text" },
    { key: "maxPremium", label: "Max Premium", type: "text" },
    { key: "auctionEnd", label: "Auction End", type: "datetime-local" },
    { key: "expiry", label: "Expiry", type: "datetime-local" },
  ];

  useEffect(() => {
    if (!isManualFlightEntry) return;
    setFlightInfo(buildManualFlightInfo(form.flightRef, form.departureTime));
  }, [isManualFlightEntry, form.flightRef, form.departureTime]);

  function enableManualEntry(prefillFlightRef = "") {
    setIsManualFlightEntry(true);
    setForm(f => ({
      ...f,
      flightRef: upperFlightRef(prefillFlightRef || f.flightRef),
      departureTime: f.departureTime || nowPlusSeconds(3600),
    }));
  }

  async function lookupFlight() {
    const airlineCode = normalizeAirlineCode(flightQuery.airlineCode);
    const flightNumber = normalizeFlightNumber(flightQuery.flightNumber);
    const departureDate = flightQuery.departureDate;
    const flightRef = buildFlightRef(airlineCode, flightNumber);

    if (!airlineCode || !flightNumber || !departureDate) {
      setFlightLookupLog({ msg: "", err: "Please enter airline code, flight number, and departure date first." });
      return;
    }
    if (departureDate < MIN_LOOKUP_DATE) {
      setFlightLookupLog({ msg: "", err: `Departure date must be on or after ${MIN_LOOKUP_DATE}.` });
      return;
    }
    const cacheKey = buildFlightLookupKey({ airlineCode, flightNumber, departureDate });

    if (flightCache[cacheKey]) {
      const cachedFlight = flightCache[cacheKey];
      setIsManualFlightEntry(false);
      setFlightInfo(cachedFlight);
      setForm(f => {
        const nextDepartureTime = apiTimeToBrowserDatetimeLocalValue(pickDepartureTime(cachedFlight), cachedFlight.departure_timezone) || f.departureTime;
        return {
          ...f,
          flightRef: cachedFlight.flightRef,
          departureTime: nextDepartureTime,
          expiry: clampExpiryValue(f.expiry, nextDepartureTime),
        };
      });
      setFlightLookupLog({ msg: `Loaded ${flightRef} on ${departureDate} from local cache.`, err: "" });
      return;
    }

    if (!CIRIUM_API_TOKEN) {
      enableManualEntry(flightRef);
      setFlightLookupLog({ msg: "", err: "Missing REACT_APP_CIRIUM_API_TOKEN in frontend/.env. Manual entry is now enabled." });
      return;
    }

    setIsFlightLookupLoading(true);
    setFlightLookupLog({ msg: `Looking up ${flightRef} on ${departureDate}...`, err: "" });
    try {
      const normalizedFlight = await fetchFlightLookupData({ airlineCode, flightNumber, departureDate });
      setFlightCache(prev => ({ ...prev, [cacheKey]: normalizedFlight }));
      setIsManualFlightEntry(false);
      setFlightInfo(normalizedFlight);
      setForm(f => {
        const nextDepartureTime = apiTimeToBrowserDatetimeLocalValue(pickDepartureTime(normalizedFlight), normalizedFlight.departure_timezone) || f.departureTime;
        return {
          ...f,
          flightRef: normalizedFlight.flightRef,
          departureTime: nextDepartureTime,
          expiry: clampExpiryValue(f.expiry, nextDepartureTime),
        };
      });
      setFlightLookupLog({ msg: `Loaded ${normalizedFlight.flightRef} on ${normalizedFlight.flight_date || departureDate}. Departure time has been filled into the policy form.`, err: "" });
    } catch (e) {
      enableManualEntry(flightRef);
      setFlightLookupLog({ msg: "", err: `${parseError(e)} Manual entry is now enabled.` });
    } finally {
      setIsFlightLookupLoading(false);
    }
  }

  async function createPolicy() {
    if (!contract) { setLog({ err: "Connect wallet first." }); return; }
    if (!canCreatePolicy) { setLog({ err: `Policy can only be created when flight status is scheduled. Current status: ${flightInfo.flight_status || "unknown"}.` }); return; }
    const now = Math.floor(Date.now() / 1000);
    const departureTs = localToTs(form.departureTime);
    const auctionEndTs = localToTs(form.auctionEnd);
    const expiryTs = localToTs(form.expiry);
    if (!form.flightRef?.trim()) { setLog({ err: "Flight Ref is required." }); return; }
    if (![departureTs, auctionEndTs, expiryTs].every(Number.isFinite)) { setLog({ err: "Please enter valid date and time values." }); return; }
    if (auctionEndTs <= now) { setLog({ err: "Auction End must be in the future." }); return; }
    if (departureTs <= now) { setLog({ err: "Departure Time must be in the future." }); return; }
    if (expiryTs <= auctionEndTs) { setLog({ err: "Expiry must be after Auction End." }); return; }
    if (expiryTs > departureTs) { setLog({ err: "Expiry cannot be later than Departure Time." }); return; }
    setLog({ msg: "Sending transaction…" });
    try {
      const tx = await contract.createPolicy(toBytes32(form.flightRef), departureTs, Number(form.delayThreshold), ethers.parseEther(form.fixedPayout), auctionEndTs, expiryTs, { value: ethers.parseEther(form.maxPremium) });
      const rcpt = await tx.wait();
      let pid = null;
      for (const l of rcpt.logs) { try { const p = contract.interface.parseLog(l); if (p.name === "PolicyCreated") { pid = p.args.policyId; break; } } catch {} }
      if (pid === null) {
        throw new Error("PolicyCreated event not found in transaction receipt. Check that the connected network and configured contract address match the deployed SkyHedgeCore contract.");
      }
      const p = await (readContract ?? contract).getPolicy(pid);
      addTxLog(buildTxLog("passenger", `Created Policy #${pid} for flight ${form.flightRef}`));
      setPolicyId(pid); setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(pid); setLog({ msg: `Policy #${pid} created!` }); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  async function transferNFT() {
    try {
      const tx = await contract.transferFrom(account, tForm.to, tForm.nftId);
      await tx.wait();
      addTxLog(buildTxLog("passenger", `Transferred NFT #${tForm.nftId} to ${shortAddr(tForm.to)}`));
      setTLog({ msg: "Transferred successfully!" }); triggerBalanceRefresh();
    } catch (e) { setTLog({ err: parseError(e) }); }
  }

  return (
    <div>
      <div style={{ marginBottom: 18, padding: "16px 18px", background: "#09111f", border: "1px solid #4fc3f744", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#4fc3f7", fontFamily: "monospace", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Flight Lookup</div>
          </div>
          <div style={{ display: "grid", gap: 8, width: "min(100%, 520px)", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <div>
              <label style={{ display: "block", color: CLR.label, fontSize: 12, marginBottom: 4 }}>Airline Code</label>
              <input
                value={flightQuery.airlineCode}
                onChange={setFlightQueryField("airlineCode")}
                onKeyDown={e => { if (e.key === "Enter") lookupFlight(); }}
                placeholder="e.g. TR"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", color: CLR.label, fontSize: 12, marginBottom: 4 }}>Flight Number</label>
              <input
                value={flightQuery.flightNumber}
                onChange={setFlightQueryField("flightNumber")}
                onKeyDown={e => { if (e.key === "Enter") lookupFlight(); }}
                placeholder="e.g. 134"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", color: CLR.label, fontSize: 12, marginBottom: 4 }}>Departure Date</label>
              <input
                type="date"
                value={flightQuery.departureDate}
                min={MIN_LOOKUP_DATE}
                onChange={setFlightQueryField("departureDate")}
                onKeyDown={e => { if (e.key === "Enter") lookupFlight(); }}
                style={inputStyle}
              />
            </div>
            <button onClick={lookupFlight} style={btnStyle("#4fc3f7", { whiteSpace: "nowrap" })} disabled={isFlightLookupLoading}>
              {isFlightLookupLoading ? "Searching..." : "Lookup"}
            </button>
          </div>
        </div>
        {isManualFlightEntry && (
          <div style={{ marginBottom: 12, color: "#fda4af", fontSize: 12, fontFamily: "monospace" }}>
            Lookup failed, so manual entry is now enabled for Flight Ref and Departure Time.
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, fontSize: 12 }}>
          <div><span style={{ color: CLR.dim }}>Flight:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{flightInfo.flightRef}</span></div>
          <div><span style={{ color: CLR.dim }}>Airline:</span> <span style={{ color: CLR.value }}>{flightInfo.airline}</span></div>
          <div><span style={{ color: CLR.dim }}>Status:</span> <span style={{ color: CLR.value }}>{flightInfo.flight_status}</span></div>
          <div><span style={{ color: CLR.dim }}>Flight Date:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{flightInfo.flight_date || "—"}</span></div>
          <div><span style={{ color: CLR.dim }}>Departure:</span> <span style={{ color: CLR.value }}>{flightInfo.departure_airport} {flightInfo.departure_iata ? `(${flightInfo.departure_iata})` : ""}</span></div>
          <div><span style={{ color: CLR.dim }}>Arrival:</span> <span style={{ color: CLR.value }}>{flightInfo.arrival_airport} {flightInfo.arrival_iata ? `(${flightInfo.arrival_iata})` : ""}</span></div>
          <div><span style={{ color: CLR.dim }}>Scheduled Departure:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{flightInfo.departure_scheduled ? formatApiTimeWithTimezone(flightInfo.departure_scheduled, flightInfo.departure_timezone) : "—"}</span></div>
          <div><span style={{ color: CLR.dim }}>Estimated Departure:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{flightInfo.departure_estimated ? formatApiTimeWithTimezone(flightInfo.departure_estimated, flightInfo.departure_timezone) : "—"}</span></div>
        </div>
        <Log {...flightLookupLog} />
      </div>
      {passengerFields.map(({ key, label, type, editable = true }) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <label style={{ display: "block", color: CLR.label, fontSize: 12 }}>{label}</label>
          <input
            type={type}
            value={form[key]}
            onChange={editable ? set(key) : undefined}
            readOnly={!editable}
            disabled={!editable}
            max={key === "expiry" ? form.departureTime : undefined}
            style={editable ? inputStyle : { ...inputStyle, color: "#94a3b8", background: "#0b1220", cursor: "not-allowed" }}
          />
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={createPolicy} disabled={!canCreatePolicy} style={canCreatePolicy ? btnStyle("#4fc3f7") : disabledBtnStyle}>Create Policy</button>
      </div>
      <Log {...log} />
      <PolicyCard policy={policy} policyId={policyId ? String(policyId) : "—"} roleAddresses={roleAddresses} />
      {policy?.policyNFTId > 0n && (
        <div style={{ marginTop: 20, padding: "15px", background: "#160d2a", borderRadius: 10 }}><input placeholder="Recipient Address" value={tForm.to} onChange={e => setTForm(f => ({ ...f, to: e.target.value }))} style={inputStyle} /><input placeholder="NFT ID" value={tForm.nftId} onChange={e => setTForm(f => ({ ...f, nftId: e.target.value }))} style={{ ...inputStyle, marginTop: 10 }} /><button onClick={transferNFT} style={{ ...btnStyle("#a78bfa"), marginTop: 10 }}>Transfer NFT</button><Log {...tLog} /></div>
      )}
    </div>
  );
}

function UnderwriterTab({ contract, readContract, roleKey, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account }) {
  const [policyId, setPolicyId] = useState("");
  const [premium, setPremium] = useState("0.01");
  const [policy, setPolicy] = useState(null);
  const [policyList, setPolicyList] = useState([]);
  const [finalizeList, setFinalizeList] = useState([]);
  const [isPolicyListLoading, setIsPolicyListLoading] = useState(false);
  const [log, setLog] = useState({ msg: "", err: "" });
  const ds = derivedStatus(policy);
  const canBid = ds === "BIDDING_OPEN";
  const canFinalize = ds === "BIDDING_ENDED" && policy?.bestUnderwriter?.toLowerCase() === account?.toLowerCase();
  const panelShellStyle = {
    padding: "12px",
    borderRadius: 12,
    border: "1px solid #253041",
    background: "#0b0f17",
    minWidth: 0,
  };

  async function fetchPolicies() {
    const reader = readContract ?? contract;
    if (!reader) {
      setPolicyList([]);
      setFinalizeList([]);
      return;
    }
    setIsPolicyListLoading(true);
    try {
      const count = Number(await reader.policyCount());
      const loaded = await Promise.all(
        Array.from({ length: count }, async (_, index) => {
          const id = index + 1;
          const item = await reader.getPolicy(id);
          return { id, policy: item };
        })
      );
      const normalizedAccount = account?.toLowerCase();
      setPolicyList(
        loaded.filter(({ policy }) => policy.passenger !== ethers.ZeroAddress && derivedStatus(policy) === "BIDDING_OPEN")
      );
      setFinalizeList(
        loaded.filter(({ policy }) =>
          policy.passenger !== ethers.ZeroAddress &&
          derivedStatus(policy) === "BIDDING_ENDED" &&
          policy.bestUnderwriter?.toLowerCase() === normalizedAccount
        )
      );
    } catch (e) {
      setLog({ err: parseError(e) });
    } finally {
      setIsPolicyListLoading(false);
    }
  }

  useEffect(() => {
    fetchPolicies();
  }, [contract, readContract, account]);

  async function loadPolicy(targetPolicyId = policyId) {
    const reader = readContract ?? contract;
    if (!reader || !targetPolicyId) return;
    try {
      const normalizedId = String(targetPolicyId);
      const p = await reader.getPolicy(normalizedId);
      setPolicyId(normalizedId);
      setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(BigInt(normalizedId));
    } catch (e) { setLog({ err: parseError(e) }); }
  }
  async function placeBid() {
    try {
      const tx = await contract.bidPremium(policyId, ethers.parseEther(premium));
      await tx.wait();
      addTxLog(buildTxLog(roleKey, `Placed bid of ${premium} ETH on Policy #${policyId}`));
      setLog({ msg: "Bid placed!" }); loadPolicy(); fetchPolicies(); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }
  async function finalize() {
    try {
      const tx = await contract.finalizeAuction(policyId, { value: policy.fixedPayout });
      await tx.wait();
      addTxLog(buildTxLog(roleKey, `Finalized Policy #${policyId} and locked ${fmtEth(policy.fixedPayout)} collateral`));
      setLog({ msg: "Finalized!" }); loadPolicy(); fetchPolicies(); triggerBalanceRefresh();
    } catch (e) { setLog({ err: parseError(e) }); }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16, alignItems: "start", marginBottom: 16 }}>
        <div style={panelShellStyle}>
          <div style={{ color: "#34d399", fontSize: 12, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Bidding Desk</div>
          <PolicySelectionList
            policies={policyList}
            selectedPolicyId={policyId}
            onSelect={loadPolicy}
            roleAddresses={roleAddresses}
            isLoading={isPolicyListLoading}
            onRefresh={fetchPolicies}
            accentColor="#34d399"
            title="Available Policies"
            subtitle="Policies still open for bidding."
          />
        </div>
        <div style={panelShellStyle}>
          <div style={{ color: "#f59e0b", fontSize: 12, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Finalization Desk</div>
          <PolicySelectionList
            policies={finalizeList}
            selectedPolicyId={policyId}
            onSelect={loadPolicy}
            roleAddresses={roleAddresses}
            isLoading={isPolicyListLoading}
            onRefresh={fetchPolicies}
            accentColor="#f59e0b"
            title="Awaiting Your Finalization"
            subtitle="Policies where your winning bid is waiting for collateral lock."
          />
        </div>
      </div>
      <PolicyCard policy={policy} policyId={policyId} roleAddresses={roleAddresses} />
      {policy && (
        <div style={{ marginTop: 15 }}>
          <input type="number" value={premium} onChange={e => setPremium(e.target.value)} style={inputStyle} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={placeBid} disabled={!canBid} style={canBid ? btnStyle("#34d399") : disabledBtnStyle}>Bid</button>
            <button onClick={finalize} disabled={!canFinalize} style={canFinalize ? btnStyle("#f59e0b") : disabledBtnStyle}>Finalize</button>
          </div>
          <Log {...log} />
        </div>
      )}
    </div>
  );
}

function SyndicateTab({ contract, readContract, account, setCurrentPolicy, setCurrentPolicyId, triggerBalanceRefresh, refreshTick }) {
  const [vaultCandidates, setVaultCandidates] = useState([]);
  const [launchedPositions, setLaunchedPositions] = useState([]);
  const [managedVaults, setManagedVaults] = useState([]);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [ownedSubscriptions, setOwnedSubscriptions] = useState([]);
  const [resolvedPositions, setResolvedPositions] = useState([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [buyingPolicyId, setBuyingPolicyId] = useState(null);
  const [log, setLog] = useState({ msg: "", err: "" });
  const [blueprint, setBlueprint] = useState({
    sharesForSale: "60",
    pricePerShare: "0.0010",
  });
  const [buyAmounts, setBuyAmounts] = useState({});

  const selectedVaultCandidate =
    vaultCandidates.find(({ id }) => String(id) === String(selectedPolicyId)) ||
    null;
  const selectedPolicy = selectedVaultCandidate?.policy ?? null;
  const sharesForSale = Math.max(0, Math.min(100, Number.parseInt(blueprint.sharesForSale || "0", 10) || 0));
  const retainedShares = Math.max(0, 100 - sharesForSale);
  const sharePriceWei = safeParseEther(blueprint.pricePerShare);
  const raiseTargetWei = sharePriceWei === null ? null : sharePriceWei * BigInt(sharesForSale);
  const maxRaiseWei = selectedPolicy ? (BigInt(selectedPolicy.fixedPayout ?? 0) * BigInt(sharesForSale)) / 100n : null;
  const listingValueValid = selectedPolicy && sharePriceWei !== null && raiseTargetWei !== null && maxRaiseWei !== null
    ? raiseTargetWei <= maxRaiseWei
    : false;
  const readyCollateralWei = sumPolicyPayouts(vaultCandidates);
  const launchedCollateralWei = sumPolicyPayouts(launchedPositions);
  const marketplaceCollateralWei = sumPolicyPayouts(marketplaceListings);
  const subscribedExposureWei = sumPolicyPayouts(ownedSubscriptions);
  const managerConfigured = Boolean(SYNDICATE_MANAGER_ADDRESS) && ethers.isAddress(SYNDICATE_MANAGER_ADDRESS);
  const launchData = sharePriceWei === null
    ? ""
    : ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [BigInt(sharesForSale), sharePriceWei]);
  useEffect(() => {
    async function fetchSyndicateData() {
      const reader = readContract ?? contract;
      if (!reader || !account) {
        setVaultCandidates([]);
        setLaunchedPositions([]);
        setManagedVaults([]);
        setMarketplaceListings([]);
        setOwnedSubscriptions([]);
        setResolvedPositions([]);
        setSelectedPolicyId("");
        setLog({ msg: "", err: "" });
        return;
      }

      setIsLoading(true);
      setLog({ msg: "", err: "" });
      try {
        const normalizedAccount = account.toLowerCase();
        const managerReader = getSyndicateManagerContract(reader, SYNDICATE_MANAGER_ADDRESS);
        const count = Number(await reader.policyCount());
        const loaded = await Promise.all(
          Array.from({ length: count }, async (_, index) => {
            const id = index + 1;
            const policy = await reader.getPolicy(id);
            if (policy.passenger === ethers.ZeroAddress) return null;

            let riskOwner = "";
            if (policy.riskNFTId > 0n) {
              try {
                riskOwner = await reader.ownerOf(policy.riskNFTId);
              } catch {
                riskOwner = "";
              }
            }

            let vaultAddress = ethers.ZeroAddress;
            let vaultDetails = null;
            if (managerReader) {
              try {
                vaultAddress = await managerReader.vaultByPolicyId(id);
              } catch {
                vaultAddress = ethers.ZeroAddress;
              }
            }

            if (vaultAddress !== ethers.ZeroAddress) {
              const vaultReader = getRiskVaultContract(reader, vaultAddress);
              if (vaultReader) {
                try {
                  const [sharesForSale, pricePerShare, leadUnderwriter, accountShares, isResolved] = await Promise.all([
                    vaultReader.sharesForSale(),
                    vaultReader.pricePerShare(),
                    vaultReader.leadUnderwriter(),
                    vaultReader.shareBalances(account),
                    vaultReader.isResolved(),
                  ]);
                  vaultDetails = { sharesForSale, pricePerShare, leadUnderwriter, accountShares, isResolved };
                } catch {
                  vaultDetails = null;
                }
              }
            }

            return { id, policy, ds: derivedStatus(policy), riskOwner, vaultAddress, vaultDetails };
          })
        );

        const entries = loaded.filter(Boolean);
        const nextVaultCandidates = entries.filter(({ policy, ds, riskOwner, vaultAddress }) =>
          ds === "ACTIVE" &&
          policy.bestUnderwriter?.toLowerCase() === normalizedAccount &&
          riskOwner?.toLowerCase() === normalizedAccount &&
          vaultAddress === ethers.ZeroAddress
        );
        const nextLaunchedPositions = entries.filter(({ policy, ds, vaultAddress }) =>
          ds === "ACTIVE" &&
          policy.bestUnderwriter?.toLowerCase() === normalizedAccount &&
          vaultAddress !== ethers.ZeroAddress
        );
        const nextManagedVaults = entries.filter(({ policy, vaultAddress }) =>
          policy.bestUnderwriter?.toLowerCase() === normalizedAccount &&
          vaultAddress !== ethers.ZeroAddress
        );
        const nextMarketplaceListings = entries.filter(({ ds, vaultAddress, vaultDetails }) =>
          ds === "ACTIVE" &&
          vaultAddress !== ethers.ZeroAddress &&
          vaultDetails &&
          Number(vaultDetails.sharesForSale) > 0 &&
          vaultDetails.leadUnderwriter?.toLowerCase() !== normalizedAccount
        );
        const nextOwnedSubscriptions = entries.filter(({ vaultAddress, vaultDetails }) =>
          vaultAddress !== ethers.ZeroAddress &&
          vaultDetails &&
          Number(vaultDetails.accountShares) > 0 &&
          vaultDetails.leadUnderwriter?.toLowerCase() !== normalizedAccount
        );
        const nextResolvedPositions = entries.filter(({ policy, ds }) =>
          (ds === "PAID" || ds === "RESOLVED_ON_TIME") &&
          policy.bestUnderwriter?.toLowerCase() === normalizedAccount
        );

        setVaultCandidates(sortPolicyEntries(nextVaultCandidates));
        setLaunchedPositions(sortPolicyEntries(nextLaunchedPositions));
        setManagedVaults(sortPolicyEntries(nextManagedVaults));
        setMarketplaceListings(sortPolicyEntries(nextMarketplaceListings));
        setOwnedSubscriptions(sortPolicyEntries(nextOwnedSubscriptions));
        setResolvedPositions(sortPolicyEntries(nextResolvedPositions));
        setSelectedPolicyId(current =>
          nextVaultCandidates.some(({ id }) => String(id) === String(current)) ? current : ""
        );
      } catch (e) {
        setVaultCandidates([]);
        setLaunchedPositions([]);
        setManagedVaults([]);
        setMarketplaceListings([]);
        setOwnedSubscriptions([]);
        setResolvedPositions([]);
        setLog({ msg: "", err: parseError(e) });
      } finally {
        setIsLoading(false);
      }
    }

    fetchSyndicateData();
  }, [contract, readContract, account, refreshTick]);

  useEffect(() => {
    if (!selectedVaultCandidate) return;
    setCurrentPolicy?.(selectedVaultCandidate.policy);
    setCurrentPolicyId?.(BigInt(selectedVaultCandidate.id));
  }, [selectedVaultCandidate, setCurrentPolicy, setCurrentPolicyId]);

  const shellStyle = {
    background: "#0d1118",
    border: "1px solid #2f3643",
    borderRadius: 18,
    padding: "18px",
    minWidth: 0,
  };

  function setBlueprintField(key) {
    return (e) => {
      const value = e.target.value;
      setBlueprint(current => ({ ...current, [key]: value }));
    };
  }

  async function launchSyndicate() {
    if (!selectedVaultCandidate) {
      setLog({ msg: "", err: "Select a vault-ready policy first." });
      return;
    }
    if (!contract || !account) {
      setLog({ msg: "", err: "Connect wallet first." });
      return;
    }
    if (!managerConfigured) {
      setLog({ msg: "", err: "Missing REACT_APP_SYNDICATE_MANAGER_ADDRESS in frontend/.env." });
      return;
    }
    if (sharePriceWei === null) {
      setLog({ msg: "", err: "Enter a valid ETH price per share first." });
      return;
    }
    if (sharesForSale <= 0 || sharesForSale > 100) {
      setLog({ msg: "", err: "Shares for sale must be between 1 and 100." });
      return;
    }
    if (!listingValueValid) {
      setLog({ msg: "", err: "Total listing value cannot exceed the same percentage of fixed payout." });
      return;
    }
    setIsLaunching(true);
    setLog({ msg: `Creating listing for Policy #${selectedVaultCandidate.id}...`, err: "" });
    try {
      const tx = await contract["safeTransferFrom(address,address,uint256,bytes)"](
        account,
        SYNDICATE_MANAGER_ADDRESS,
        selectedVaultCandidate.policy.riskNFTId,
        launchData
      );
      await tx.wait();
      const manager = getSyndicateManagerContract(contract, SYNDICATE_MANAGER_ADDRESS);
      const vaultAddress = manager ? await manager.vaultByPolicyId(selectedVaultCandidate.id) : ethers.ZeroAddress;
      setLog({
        msg: vaultAddress && vaultAddress !== ethers.ZeroAddress
          ? `Listing created. Vault created at ${shortAddr(vaultAddress)} for Policy #${selectedVaultCandidate.id}.`
          : `Listing submitted for Policy #${selectedVaultCandidate.id}. Refreshing vault data now.`,
        err: "",
      });
      triggerBalanceRefresh?.();
    } catch (e) {
      setLog({ msg: "", err: parseError(e) });
    } finally {
      setIsLaunching(false);
    }
  }

  function setBuyAmount(policyId) {
    return (e) => {
      const nextValue = e.target.value;
      if (!/^\d*$/.test(nextValue)) {
        return;
      }
      setBuyAmounts(current => ({ ...current, [String(policyId)]: nextValue }));
    };
  }

  function parseBuyAmount(rawAmount, sharesAvailable) {
    if (!/^[1-9]\d*$/.test(rawAmount)) {
      return { amount: 0, error: "Enter a whole number greater than 0." };
    }
    const amount = Number.parseInt(rawAmount, 10);
    if (amount > sharesAvailable) {
      return { amount, error: `Only ${sharesAvailable} shares are currently available.` };
    }
    return { amount, error: "" };
  }

  async function buyListingShares(entry) {
    if (!entry?.vaultAddress) {
      setLog({ msg: "", err: "Vault address is missing for this listing." });
      return;
    }
    if (!contract || !account) {
      setLog({ msg: "", err: "Connect wallet first." });
      return;
    }
    const sharesAvailable = Number(entry.vaultDetails?.sharesForSale ?? 0);
    const rawAmount = buyAmounts[String(entry.id)] ?? "1";
    const { amount: amountToBuy, error: buyAmountError } = parseBuyAmount(rawAmount, sharesAvailable);
    if (buyAmountError) {
      setLog({ msg: "", err: buyAmountError });
      return;
    }
    const pricePerShareWei = BigInt(entry.vaultDetails?.pricePerShare ?? 0);
    if (pricePerShareWei <= 0n) {
      setLog({ msg: "", err: "This listing does not have a valid price." });
      return;
    }

    const totalCost = pricePerShareWei * BigInt(amountToBuy);
    const vault = getRiskVaultContract(contract, entry.vaultAddress);
    if (!vault) {
      setLog({ msg: "", err: "Vault contract is not available." });
      return;
    }

    setBuyingPolicyId(entry.id);
    setLog({ msg: `Submitting buy order for Policy #${entry.id}...`, err: "" });
    try {
      const tx = await vault.buyShares(amountToBuy, { value: totalCost });
      await tx.wait();
      setLog({ msg: `Bought ${amountToBuy} share${amountToBuy === 1 ? "" : "s"} from Policy #${entry.id}.`, err: "" });
      setBuyAmounts(current => ({ ...current, [String(entry.id)]: "1" }));
      triggerBalanceRefresh?.();
    } catch (e) {
      setLog({ msg: "", err: parseError(e) });
    } finally {
      setBuyingPolicyId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {[
          { label: "Vault-Ready Positions", value: String(vaultCandidates.length), tone: "#fb923c", sub: "ACTIVE policies where you still hold the Risk NFT" },
          { label: "Listed Risk Vaults", value: String(launchedPositions.length), tone: "#f97316", sub: `${fmtEth(launchedCollateralWei)} of risk now listed through the marketplace` },
          { label: "Open Marketplace", value: String(marketplaceListings.length), tone: "#38bdf8", sub: `${fmtEth(marketplaceCollateralWei)} of external risk currently available to subscribe` },
          { label: "Your Positions", value: String(ownedSubscriptions.length), tone: "#22c55e", sub: `${fmtEth(subscribedExposureWei)} of subscribed risk tracked in your portfolio` },
        ].map(card => (
          <div key={card.label} style={{ background: "#0d1118", border: `1px solid ${card.tone}44`, borderRadius: 16, padding: "16px 18px" }}>
            <div style={{ color: card.tone, fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{card.label}</div>
            <div style={{ color: "#fff7ed", fontSize: 28, fontWeight: 700, marginBottom: 6 }}>{card.value}</div>
            <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.5 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 1.05fr) minmax(340px, 1fr)", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <section style={shellStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#fb923c", fontSize: 12, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Vault Launchpad</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>Policies that are already underwritten by you and ready to move into a dedicated vault.</div>
              </div>
              <button onClick={triggerBalanceRefresh} style={btnStyle("#fb923c")}>
                {isLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {!vaultCandidates.length ? (
              <div style={{ padding: "20px 0", color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
                {isLoading
                  ? "Loading vault candidates from chain..."
                  : "No available positions right now."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {vaultCandidates.map(({ id, policy, ds }) => {
                  const isSelected = String(id) === String(selectedVaultCandidate?.id);
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedPolicyId(String(id))}
                      style={{
                        background: isSelected ? "#2b1a11" : "#11161f",
                        border: `1px solid ${isSelected ? "#fb923c88" : "#253041"}`,
                        borderRadius: 14,
                        padding: "14px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <div style={{ color: "#fff", fontSize: 14, fontFamily: "monospace", fontWeight: 700 }}>Policy #{id}</div>
                        <DerivedStatusBadge ds={ds} />
                      </div>
                      <div style={{ display: "grid", gap: 5, fontSize: 12 }}>
                        <div><span style={{ color: CLR.dim }}>Flight:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fromBytes32(policy.flightRef)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Scheduled Departure:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{tsToLocal(policy.departureTime)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Fixed Payout:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fmtEth(policy.fixedPayout)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Risk NFT:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>#{policy.riskNFTId.toString()}</span></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section style={{ ...shellStyle, background: "linear-gradient(180deg, #151b23 0%, #0d1118 100%)" }}>
            <div style={{ color: "#fdba74", fontSize: 12, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10 }}>
              Listing Builder
            </div>
            {selectedPolicy ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
                  <div><span style={{ color: CLR.dim }}>Flight Number:</span><div style={{ color: "#fff7ed", fontFamily: "monospace", marginTop: 4 }}>{fromBytes32(selectedPolicy.flightRef)}</div></div>
                  <div><span style={{ color: CLR.dim }}>Scheduled Departure:</span><div style={{ color: "#fff7ed", fontFamily: "monospace", marginTop: 4 }}>{tsToLocal(selectedPolicy.departureTime)}</div></div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
                  <div><span style={{ color: CLR.dim }}>Risk NFT:</span><div style={{ color: "#fff7ed", fontFamily: "monospace", marginTop: 4 }}>#{selectedPolicy.riskNFTId.toString()}</div></div>
                  <div><span style={{ color: CLR.dim }}>Fixed Payout:</span><div style={{ color: "#fff7ed", fontFamily: "monospace", marginTop: 4 }}>{fmtEth(selectedPolicy.fixedPayout)}</div></div>
                  <div><span style={{ color: CLR.dim }}>Best Premium:</span><div style={{ color: "#fff7ed", fontFamily: "monospace", marginTop: 4 }}>{fmtEth(selectedPolicy.bestPremium)}</div></div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", color: CLR.label, fontSize: 12, marginBottom: 4 }}>Shares For Sale</label>
                    <input value={blueprint.sharesForSale} onChange={setBlueprintField("sharesForSale")} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: CLR.label, fontSize: 12, marginBottom: 4 }}>Price Per Share (ETH)</label>
                    <input value={blueprint.pricePerShare} onChange={setBlueprintField("pricePerShare")} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
                  <div style={{ background: "#11161f", border: "1px solid #2d3445", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Lead Retention</div>
                    <div style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>{retainedShares}%</div>
                  </div>
                  <div style={{ background: "#11161f", border: "1px solid #2d3445", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Raise Target</div>
                    <div style={{ color: listingValueValid ? "#fff" : "#fda4af", fontSize: 22, fontWeight: 700 }}>{raiseTargetWei === null ? "Invalid" : fmtEth(raiseTargetWei)}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
                      Max allowed {maxRaiseWei === null ? "—" : fmtEth(maxRaiseWei)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                  <button
                    onClick={launchSyndicate}
                    disabled={isLaunching || !selectedVaultCandidate || selectedVaultCandidate.vaultAddress !== ethers.ZeroAddress || !managerConfigured || sharePriceWei === null || sharesForSale <= 0 || !listingValueValid}
                    style={isLaunching || !selectedVaultCandidate || selectedVaultCandidate.vaultAddress !== ethers.ZeroAddress || !managerConfigured || sharePriceWei === null || sharesForSale <= 0 || !listingValueValid ? disabledBtnStyle : btnStyle("#fb923c")}
                  >
                    {isLaunching ? "Creating..." : "Create Listing"}
                  </button>
                </div>
                {!listingValueValid && selectedPolicy && (
                  <div style={{ marginTop: 12, color: "#fda4af", fontSize: 12, lineHeight: 1.6 }}>
                    Listing value is too high. If you sell {sharesForSale}% of the risk side, the total raise must stay at or below {fmtEth(maxRaiseWei)}.
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
                Click an active policy in Vault Launchpad above to view and configure its listing details.
              </div>
            )}
          </section>

          <section style={shellStyle}>
            <div style={{ color: "#f97316", fontSize: 12, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>
              Your Managed Vaults
            </div>
            {!managedVaults.length ? (
              <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
                No managed vaults yet. Once you create a marketplace listing, both active and historical vaults you manage will appear here.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {managedVaults.map(({ id, policy, ds, vaultAddress }) => (
                  <div
                    key={id}
                    style={{
                      background: "#11161f",
                      border: "1px solid #2d3445",
                      borderRadius: 12,
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <div style={{ color: "#fff", fontFamily: "monospace", fontWeight: 700 }}>Policy #{id}</div>
                      <DerivedStatusBadge ds={ds} />
                    </div>
                    <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                      <div><span style={{ color: CLR.dim }}>Flight:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fromBytes32(policy.flightRef)}</span></div>
                      <div><span style={{ color: CLR.dim }}>Fixed Payout:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fmtEth(policy.fixedPayout)}</span></div>
                      <div><span style={{ color: CLR.dim }}>Risk NFT:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>#{policy.riskNFTId.toString()}</span></div>
                      <div><span style={{ color: CLR.dim }}>Vault:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{vaultAddress}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <section style={shellStyle}>
          <div style={{ color: "#38bdf8", fontSize: 12, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>
            Open Marketplace
          </div>
          {!marketplaceListings.length ? (
            <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
              No external listings are open right now. Once another underwriter lists a Risk NFT with remaining shares for sale, it will appear here for subscription.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
              {marketplaceListings.map((entry) => {
                const sharesAvailable = Number(entry.vaultDetails?.sharesForSale ?? 0);
                const accountShares = Number(entry.vaultDetails?.accountShares ?? 0);
                const pricePerShare = BigInt(entry.vaultDetails?.pricePerShare ?? 0);
                const buyAmount = buyAmounts[String(entry.id)] ?? "1";
                const { amount: parsedBuyAmount, error: buyAmountError } = parseBuyAmount(buyAmount, sharesAvailable);
                const totalCost = !buyAmountError && parsedBuyAmount > 0 ? pricePerShare * BigInt(parsedBuyAmount) : 0n;
                const isBuyingThis = buyingPolicyId === entry.id;
                return (
                  <div key={entry.id} style={{ background: "#11161f", border: "1px solid #2d3445", borderRadius: 12, padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <div style={{ color: "#fff", fontFamily: "monospace", fontWeight: 700 }}>Policy #{entry.id}</div>
                      <DerivedStatusBadge ds={entry.ds} />
                    </div>
                    <div style={{ display: "grid", gap: 5, fontSize: 12, marginBottom: 12 }}>
                      <div><span style={{ color: CLR.dim }}>Flight:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fromBytes32(entry.policy.flightRef)}</span></div>
                      <div><span style={{ color: CLR.dim }}>Lead UW:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{shortAddr(entry.vaultDetails?.leadUnderwriter)}</span></div>
                      <div><span style={{ color: CLR.dim }}>Shares Available:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{sharesAvailable}</span></div>
                      <div><span style={{ color: CLR.dim }}>Price / Share:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fmtEth(pricePerShare)}</span></div>
                      <div><span style={{ color: CLR.dim }}>Your Shares:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{accountShares}</span></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "center" }}>
                      <input value={buyAmount} onChange={setBuyAmount(entry.id)} inputMode="numeric" pattern="[0-9]*" style={inputStyle} />
                      <button
                        onClick={() => buyListingShares(entry)}
                        disabled={isBuyingThis || Boolean(buyAmountError)}
                        style={isBuyingThis || Boolean(buyAmountError) ? disabledBtnStyle : btnStyle("#38bdf8")}
                      >
                        {isBuyingThis ? "Buying..." : `Buy for ${fmtEth(totalCost)}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </section>

          <section style={shellStyle}>
            <div style={{ color: "#22c55e", fontSize: 12, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 12 }}>
              Your Risk Positions
            </div>
            {!ownedSubscriptions.length ? (
              <div style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.7 }}>
                You have not subscribed to any marketplace shares yet. Once you buy from the marketplace, your positions will appear here.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {ownedSubscriptions.map(({ id, policy, ds, vaultAddress, vaultDetails }) => {
                  const accountShares = Number(vaultDetails?.accountShares ?? 0);
                  const pricePerShare = BigInt(vaultDetails?.pricePerShare ?? 0);
                  const costBasisWei = pricePerShare * BigInt(accountShares);
                  const collateralExposureWei = (BigInt(policy.fixedPayout ?? 0) * BigInt(accountShares)) / 100n;
                  return (
                    <div
                      key={id}
                      style={{
                        background: "#11161f",
                        border: "1px solid #2d3445",
                        borderRadius: 12,
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <div style={{ color: "#fff", fontFamily: "monospace", fontWeight: 700 }}>Policy #{id}</div>
                        <DerivedStatusBadge ds={ds} />
                      </div>
                      <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                        <div><span style={{ color: CLR.dim }}>Flight:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fromBytes32(policy.flightRef)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Scheduled Departure:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{tsToLocal(policy.departureTime)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Your Shares:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{accountShares}</span></div>
                        <div><span style={{ color: CLR.dim }}>Avg Price / Share:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fmtEth(pricePerShare)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Cost Basis:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fmtEth(costBasisWei)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Risk Exposure:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fmtEth(collateralExposureWei)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Vault:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{vaultAddress}</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <Log {...log} />
    </div>
  );
}

function ResolverTab({ contract, readContract, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account }) {
  const [policyId, setPolicyId] = useState("");
  const [policy, setPolicy] = useState(null);
  const [policyList, setPolicyList] = useState([]);
  const [isPolicyListLoading, setIsPolicyListLoading] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [nowTs, setNowTs] = useState(Math.floor(Date.now() / 1000));
  const [log, setLog] = useState({ msg: "", err: "" });
  const policyDerivedStatus = derivedStatus(policy);
  const canResolve = policyDerivedStatus === "ACTIVE" && isSettlementWindowOpen(policy, nowTs);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(timer);
  }, []);

  async function fetchPolicies() {
    const reader = readContract ?? contract;
    if (!reader) {
      setPolicyList([]);
      return;
    }
    setIsPolicyListLoading(true);
    try {
      const count = Number(await reader.policyCount());
      const loaded = await Promise.all(
        Array.from({ length: count }, async (_, index) => {
          const id = index + 1;
          const item = await reader.getPolicy(id);
          return { id, policy: item };
        })
      );
      setPolicyList(
        loaded.filter(({ policy }) =>
          policy.passenger !== ethers.ZeroAddress &&
          derivedStatus(policy) === "ACTIVE"
        )
      );
    } catch (e) {
      setLog({ err: parseError(e) });
    } finally {
      setIsPolicyListLoading(false);
    }
  }

  useEffect(() => {
    fetchPolicies();
  }, [contract, readContract]);

  async function loadPolicy(targetPolicyId = policyId) {
    const reader = readContract ?? contract;
    if (!reader || !targetPolicyId) return;
    try {
      const normalizedId = String(targetPolicyId);
      const p = await reader.getPolicy(normalizedId);
      setPolicyId(normalizedId);
      setPolicy(p); setCurrentPolicy(p); setCurrentPolicyId(BigInt(normalizedId));
    } catch (e) { setLog({ err: parseError(e) }); }
  }
  async function resolve() {
    if (!contract || !policy) {
      setLog({ msg: "", err: "Load an active policy first." });
      return;
    }
    if (policyDerivedStatus !== "ACTIVE") {
      setLog({ msg: "", err: "Only active policies can be resolved." });
      return;
    }
    const resolveAfterTs = settlementReadyTs(policy);
    if (nowTs < resolveAfterTs) {
      setLog({ msg: "", err: `Resolve is locked until ${tsToLocal(resolveAfterTs)}.` });
      return;
    }
    const flightRef = upperFlightRef(fromBytes32(policy.flightRef));
    if (!flightRef) {
      setLog({ msg: "", err: "This policy has no valid flight number." });
      return;
    }
    const lookupQuery = {
      ...splitFlightRef(flightRef),
      departureDate: unixTsToDateInputValue(policy.departureTime),
    };
    if (!lookupQuery.airlineCode || !lookupQuery.flightNumber || !lookupQuery.departureDate) {
      setLog({ msg: "", err: "This policy cannot be converted into a valid Cirium lookup query." });
      return;
    }
    setIsResolving(true);
    setLog({ msg: "Fetching delay data from Cirium...", err: "" });
    try {
      const flightInfo = await fetchFlightLookupData(lookupQuery);
      const delayDetails = pickFlightDelayDetails(flightInfo);
      if (delayDetails.delayMins === null) {
        throw new Error(`Cirium did not return a usable delay field for ${flightRef} yet.`);
      }
      const tx = await contract.resolvePolicy(policyId, delayDetails.delayMins);
      await tx.wait();
      addTxLog(buildTxLog("resolver", `Resolved Policy #${policyId} from Cirium ${delayDetails.source} = ${delayDetails.delayMins} min`));
      setLog({ msg: `Resolved from Cirium. ${delayDetails.source} reported ${delayDetails.delayMins} minutes of delay.`, err: "" });
      loadPolicy(); fetchPolicies(); triggerBalanceRefresh();
    } catch (e) { setLog({ msg: "", err: parseError(e) }); }
    finally { setIsResolving(false); }
  }

  const resolveAfterTs = policy ? settlementReadyTs(policy) : 0;
  const resolveWindowMessage = policy
    ? canResolve
      ? "Resolve is unlocked. Clicking the button will fetch the delay field from Cirium."
      : `Resolve unlocks at ${tsToLocal(resolveAfterTs)}.`
    : "";

  return (
    <div>
      <PolicySelectionList
        policies={policyList}
        selectedPolicyId={policyId}
        onSelect={loadPolicy}
        roleAddresses={roleAddresses}
        isLoading={isPolicyListLoading}
        onRefresh={fetchPolicies}
        accentColor="#f59e0b"
        title="Policies Awaiting API Settlement"
        subtitle="Resolver cannot enter delay minutes manually. Resolve uses Cirium delay data."
      />
      <PolicyCard policy={policy} policyId={policyId} roleAddresses={roleAddresses} />
      {policy && (
        <div style={{ marginTop: 15 }}>
          <div style={{ marginBottom: 10, color: canResolve ? "#fcd34d" : "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>
            {resolveWindowMessage}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button onClick={resolve} disabled={!canResolve || isResolving} style={canResolve && !isResolving ? btnStyle("#f59e0b") : disabledBtnStyle}>
              {isResolving ? "Resolving..." : "Resolve From API"}
            </button>
          </div>
          <Log {...log} />
        </div>
      )}
    </div>
  );
}

function RightPanel({ contract, readContract, roleAddresses, currentPolicyId, txLog, account, refreshTick, activeMode, addTxLog, triggerBalanceRefresh }) {
  const [relatedPolicies, setRelatedPolicies] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [expandedPolicyId, setExpandedPolicyId] = useState(null);
  const [refundingPolicyId, setRefundingPolicyId] = useState(null);
  const [settlingPolicyId, setSettlingPolicyId] = useState(null);
  const [panelActionState, setPanelActionState] = useState({ policyId: null, msg: "", err: "" });
  const [coordinatorStatus, setCoordinatorStatus] = useState({
    pendingRequestId: ethers.ZeroHash,
    pendingPolicyId: null,
  });
  const [policySettlementStates, setPolicySettlementStates] = useState({});
  const [policyResolutionStates, setPolicyResolutionStates] = useState({});
  const [policyAuctionStates, setPolicyAuctionStates] = useState({});

  useEffect(() => {
    async function fetchRelevantPolicies() {
      const reader = readContract ?? contract;
      if (!reader || !account) {
        setRelatedPolicies([]);
        setPanelError("");
        return;
      }

      setIsLoading(true);
      setPanelError("");
      try {
        const normalizedAccount = account.toLowerCase();
        let entries = [];

        if (activeMode === "passenger" || activeMode === "resolver") {
          const count = Number(await reader.policyCount());
          const loaded = await Promise.all(
            Array.from({ length: count }, async (_, index) => {
              const id = index + 1;
              const policy = await reader.getPolicy(id);
              return { id, policy, ds: derivedStatus(policy) };
            })
          );

          if (activeMode === "passenger") {
            entries = loaded
              .filter(({ policy }) => policy.passenger?.toLowerCase() === normalizedAccount)
              .map(entry => ({ ...entry, relation: "Created by you" }));
          } else {
            entries = loaded
              .filter(({ policy }) => policy.passenger !== ethers.ZeroAddress)
              .map(entry => ({
                ...entry,
                relation: entry.ds === "ACTIVE"
                  ? isSettlementWindowOpen(entry.policy)
                    ? "Ready to resolve from API"
                    : `Resolve unlocks at ${tsToLocal(settlementReadyTs(entry.policy))}`
                  : "Waiting for finalization or already settled",
              }));
          }
        } else if (activeMode === "underwriter") {
          const count = Number(await reader.policyCount());
          const allPolicies = await Promise.all(
            Array.from({ length: count }, async (_, index) => {
              const id = index + 1;
              const policy = await reader.getPolicy(id);
              return { id, policy, ds: derivedStatus(policy) };
            })
          );
          try {
            const latestBlock = await reader.runner.provider.getBlockNumber();
            const fromBlock = latestBlock < DEPLOY_BLOCK ? 0 : DEPLOY_BLOCK;
            const bidEvents = await reader.queryFilter(reader.filters.BidPlaced(null, account), fromBlock, latestBlock);
            const participatedIds = new Set(bidEvents.map(event => Number(event.args?.policyId)).filter(Boolean));

            entries = allPolicies
              .filter(({ id }) => participatedIds.has(id))
              .map(({ id, policy, ds }) => {
                const isLeading = policy.bestUnderwriter?.toLowerCase() === normalizedAccount;
                const relation = isLeading
                  ? ds === "ACTIVE"
                    ? "Underwritten by you"
                    : ds === "BIDDING_ENDED"
                      ? "Waiting for your finalization"
                      : ds === "PAID" || ds === "RESOLVED_ON_TIME"
                        ? "Previously underwritten by you"
                        : "You are currently winning"
                  : "You placed a bid";
                return { id, policy, ds, relation };
              });
          } catch {
            entries = allPolicies
              .filter(({ policy }) => policy.bestUnderwriter?.toLowerCase() === normalizedAccount)
              .map(({ id, policy, ds }) => ({
                id,
                policy,
                ds,
                relation: ds === "ACTIVE"
                  ? "Underwritten by you"
                  : ds === "BIDDING_ENDED"
                    ? "Waiting for your finalization"
                    : ds === "PAID" || ds === "RESOLVED_ON_TIME"
                      ? "Previously underwritten by you"
                      : "You are currently winning",
              }));
          }
        }

        setRelatedPolicies(sortPolicyEntries(entries));
      } catch (e) {
        setPanelError(parseError(e));
      } finally {
        setIsLoading(false);
      }
    }

    fetchRelevantPolicies();
  }, [contract, readContract, account, activeMode, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    let timerId = null;

    async function fetchCoordinatorStatus() {
      if (ACTIVE_NETWORK_KEY !== "sepolia") {
        if (!cancelled) {
          setCoordinatorStatus({
            pendingRequestId: ethers.ZeroHash,
            pendingPolicyId: null,
          });
        }
        return;
      }

      const reader = getCoordinatorContract(readContract ?? contract, roleAddresses.resolver);
      if (!reader) return;

      try {
        const [pendingRequestId, pendingPolicyId] = await Promise.all([
          reader.pendingRequestId(),
          reader.pendingPolicyId(),
        ]);

        if (!cancelled) {
          setCoordinatorStatus({
            pendingRequestId,
            pendingPolicyId: Number(pendingPolicyId),
          });
        }
      } catch {
        if (!cancelled) {
          setCoordinatorStatus({
            pendingRequestId: ethers.ZeroHash,
            pendingPolicyId: null,
          });
        }
      }
    }

    fetchCoordinatorStatus();
    timerId = window.setInterval(fetchCoordinatorStatus, 8000);

    return () => {
      cancelled = true;
      if (timerId) window.clearInterval(timerId);
    };
  }, [contract, readContract, roleAddresses.resolver, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    let timerId = null;

    async function fetchPolicySettlementStates() {
      if (ACTIVE_NETWORK_KEY !== "sepolia") {
        if (!cancelled) setPolicySettlementStates({});
        return;
      }

      const reader = getCoordinatorContract(readContract ?? contract, roleAddresses.resolver);
      if (!reader || !relatedPolicies.length) {
        if (!cancelled) setPolicySettlementStates({});
        return;
      }

      const trackedPolicyIds = relatedPolicies.map(({ id }) => Number(id));

      if (!trackedPolicyIds.length) {
        if (!cancelled) setPolicySettlementStates({});
        return;
      }

      try {
        const entries = await Promise.all(
          trackedPolicyIds.map(async (id) => {
            const [pendingRequestId, lastRequestId, lastResponse, lastError] = await reader.getPolicySettlementState(id);
            return [String(id), { pendingRequestId, lastRequestId, lastResponse, lastError }];
          })
        );

        if (!cancelled) {
          setPolicySettlementStates(Object.fromEntries(entries));
        }
      } catch {
        if (!cancelled) setPolicySettlementStates({});
      }
    }

    fetchPolicySettlementStates();
    timerId = window.setInterval(fetchPolicySettlementStates, 8000);

    return () => {
      cancelled = true;
      if (timerId) window.clearInterval(timerId);
    };
  }, [contract, readContract, roleAddresses.resolver, relatedPolicies, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function fetchPolicyLifecycleEvents() {
      const reader = readContract ?? contract;
      if (!reader || !relatedPolicies.length) {
        if (!cancelled) {
          setPolicyResolutionStates({});
          setPolicyAuctionStates({});
        }
        return;
      }

      try {
        const latestBlock = await reader.runner.provider.getBlockNumber();
        const fromBlock = latestBlock < DEPLOY_BLOCK ? 0 : DEPLOY_BLOCK;
        const policyIds = relatedPolicies.map(({ id }) => Number(id));

        const [resolutionEntries, auctionEntries] = await Promise.all([
          Promise.all(
            policyIds.map(async (id) => {
              const events = await reader.queryFilter(reader.filters.PolicyResolved(id), fromBlock, latestBlock);
              const latest = events.at(-1);
              if (!latest?.args) return [String(id), null];
              return [
                String(id),
                {
                  recipient: latest.args.recipient,
                  amount: latest.args.amount,
                  result: Number(latest.args.result),
                  txHash: latest.transactionHash,
                },
              ];
            })
          ),
          Promise.all(
            policyIds.map(async (id) => {
              const events = await reader.queryFilter(reader.filters.AuctionFinalized(id), fromBlock, latestBlock);
              const latest = events.at(-1);
              if (!latest?.args) return [String(id), null];
              return [
                String(id),
                {
                  underwriter: latest.args.underwriter,
                  premiumPaid: latest.args.premiumPaid,
                  refundToPassenger: latest.args.refundToPassenger,
                  policyNFTId: latest.args.policyNFTId,
                  riskNFTId: latest.args.riskNFTId,
                  txHash: latest.transactionHash,
                },
              ];
            })
          ),
        ]);

        if (!cancelled) {
          setPolicyResolutionStates(Object.fromEntries(resolutionEntries.filter(([, value]) => value)));
          setPolicyAuctionStates(Object.fromEntries(auctionEntries.filter(([, value]) => value)));
        }
      } catch {
        if (!cancelled) {
          setPolicyResolutionStates({});
          setPolicyAuctionStates({});
        }
      }
    }

    fetchPolicyLifecycleEvents();
    return () => {
      cancelled = true;
    };
  }, [contract, readContract, relatedPolicies, refreshTick]);

  async function refundExpiredPolicy(targetPolicyId) {
    if (!contract) {
      setPanelActionState({ policyId: targetPolicyId, msg: "", err: "Connect wallet first." });
      return;
    }
    setRefundingPolicyId(targetPolicyId);
    setPanelActionState({ policyId: targetPolicyId, msg: "", err: "" });
    try {
      const tx = await contract.expireUnbidPolicy(targetPolicyId);
      await tx.wait();
      addTxLog?.(buildTxLog("passenger", `Refunded expired unbid Policy #${targetPolicyId}`));
      setPanelActionState({ policyId: targetPolicyId, msg: "Refunded successfully!", err: "" });
      triggerBalanceRefresh?.();
    } catch (e) {
      setPanelActionState({ policyId: targetPolicyId, msg: "", err: parseError(e) });
    } finally {
      setRefundingPolicyId(null);
    }
  }

  async function requestChainlinkSettlement(targetPolicyId, policy) {
    if (!contract) {
      setPanelActionState({ policyId: targetPolicyId, msg: "", err: "Connect wallet first." });
      return;
    }
    if (ACTIVE_NETWORK_KEY !== "sepolia") {
      setPanelActionState({ policyId: targetPolicyId, msg: "", err: "Chainlink-triggered settlement is only enabled on Sepolia." });
      return;
    }

    const normalizedAccount = account?.toLowerCase();
    const isAuthorizedParticipant = normalizedAccount && (
      policy.passenger?.toLowerCase() === normalizedAccount ||
      policy.bestUnderwriter?.toLowerCase() === normalizedAccount
    );

    if (!isAuthorizedParticipant) {
      setPanelActionState({ policyId: targetPolicyId, msg: "", err: "Only the passenger or winning underwriter can request settlement." });
      return;
    }

    if (derivedStatus(policy) !== "ACTIVE") {
      setPanelActionState({ policyId: targetPolicyId, msg: "", err: "Only active policies can request settlement." });
      return;
    }

    const resolveAfterTs = settlementReadyTs(policy);
    const nowTs = Math.floor(Date.now() / 1000);
    if (nowTs < resolveAfterTs) {
      setPanelActionState({ policyId: targetPolicyId, msg: "", err: `Settlement unlocks at ${tsToLocal(resolveAfterTs)}.` });
      return;
    }

    const coordinator = getCoordinatorContract(contract, roleAddresses.resolver);
    if (!coordinator) {
      setPanelActionState({ policyId: targetPolicyId, msg: "", err: "Settlement coordinator is not configured." });
      return;
    }

    setSettlingPolicyId(targetPolicyId);
    setPanelActionState({ policyId: targetPolicyId, msg: "", err: "" });
    try {
      const tx = await coordinator.requestPolicySettlement(targetPolicyId);
      await tx.wait();
      addTxLog?.(buildTxLog(activeMode === "underwriter" ? "underwriter" : "passenger", `Requested Chainlink settlement for Policy #${targetPolicyId}`));
      setPanelActionState({ policyId: targetPolicyId, msg: "Chainlink settlement request submitted. Wait for the DON callback to settle the policy.", err: "" });
      triggerBalanceRefresh?.();
    } catch (e) {
      setPanelActionState({ policyId: targetPolicyId, msg: "", err: parseError(e) });
    } finally {
      setSettlingPolicyId(null);
    }
  }

  const panelMeta = {
    passenger: { title: "YOUR POLICIES", accent: "#4fc3f7", empty: "You haven't created any policies yet." },
    underwriter: { title: "YOUR BIDDED POLICIES", accent: "#34d399", empty: "You haven't placed any bids yet." },
    resolver: { title: "RESOLUTION QUEUE", accent: "#f59e0b", empty: "No policies are available to review right now." },
    default: { title: "RELATED POLICIES", accent: "#94a3b8", empty: "No related policies found." },
  }[activeMode] ?? { title: "RELATED POLICIES", accent: "#94a3b8", empty: "No related policies found." };
  const groupedPolicies = groupPolicyEntriesByStatus(relatedPolicies);

  return (
    <div style={{ flex: 2, background: "#0d0f14", borderLeft: "1px solid #1e2330", overflowY: "auto", padding: "16px", minWidth: 0, minHeight: 0 }}>
      <h3 style={{ fontSize: 13, color: panelMeta.accent, marginBottom: 15 }}>{panelMeta.title}</h3>
      {panelError && <div style={{ marginBottom: 12, padding: "10px 12px", background: "#7c2d1222", border: "1px solid #ef444444", borderRadius: 6, color: "#fca5a5", fontSize: 12, fontFamily: "monospace" }}>{panelError}</div>}
      {isLoading ? (
        <div style={{ color: CLR.dim, fontSize: 13, marginBottom: 16 }}>Loading related policies...</div>
      ) : !relatedPolicies.length ? (
        <div style={{ color: CLR.dim, fontSize: 13, marginBottom: 16 }}>{panelMeta.empty}</div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {groupedPolicies.map(group => (
            <section key={group.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ color: panelMeta.accent, fontSize: 12, fontFamily: "monospace", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                  {group.title}
                </div>
                <div style={{ flex: 1, height: 1, background: "#253041" }} />
                <div style={{ color: CLR.dim, fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {group.entries.length} {group.entries.length === 1 ? "policy" : "policies"}
                </div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {group.entries.map(({ id, policy, ds, relation }) => {
                  const isActiveSelection = String(currentPolicyId) === String(id);
                  const isExpanded = String(expandedPolicyId) === String(id);
                  const bestPremium = (!policy.maxPremium || policy.bestPremium === policy.maxPremium) ? "(no bids yet)" : fmtEth(policy.bestPremium);
                  const shouldShowRelation = relation && relation !== "Created by you";
                  const canRefundFromRightPanel = activeMode === "passenger" && ds === "UNBID_EXPIRED" && policy.passenger?.toLowerCase() === account?.toLowerCase();
                  const canRequestSettlementFromRightPanel =
                    ACTIVE_NETWORK_KEY === "sepolia" &&
                    (activeMode === "passenger" || activeMode === "underwriter") &&
                    ds === "ACTIVE" &&
                    (
                      policy.passenger?.toLowerCase() === account?.toLowerCase() ||
                      policy.bestUnderwriter?.toLowerCase() === account?.toLowerCase()
                    );
                  const settlementUnlockTs = settlementReadyTs(policy);
                  const isPendingForThisPolicy =
                    coordinatorStatus.pendingRequestId !== ethers.ZeroHash &&
                    coordinatorStatus.pendingPolicyId === Number(id);
                  const anotherPolicyIsPending =
                    coordinatorStatus.pendingRequestId !== ethers.ZeroHash &&
                    coordinatorStatus.pendingPolicyId !== null &&
                    coordinatorStatus.pendingPolicyId !== Number(id);
                  const isSettlementUnlocked = canRequestSettlementFromRightPanel && isSettlementWindowOpen(policy) && !anotherPolicyIsPending && !isPendingForThisPolicy;
                  const shouldShowSettlementBlock =
                    ACTIVE_NETWORK_KEY === "sepolia" &&
                    (activeMode === "passenger" || activeMode === "underwriter") &&
                    ds === "ACTIVE";
                  const policySettlementState = policySettlementStates[String(id)] || {
                    pendingRequestId: ethers.ZeroHash,
                    lastRequestId: ethers.ZeroHash,
                    lastResponse: "0x",
                    lastError: "0x",
                  };
                  const resolutionState = policyResolutionStates[String(id)] || null;
                  const auctionState = policyAuctionStates[String(id)] || null;
                  const premiumPaid = auctionState?.premiumPaid ?? (policy.policyNFTId > 0n ? policy.bestPremium : null);
                  const passengerRefund = auctionState?.refundToPassenger ?? (policy.policyNFTId > 0n ? subtractBigInts(policy.maxPremium, policy.bestPremium) : null);
                  const finalTransferText = resolutionState
                    ? `${fmtEth(resolutionState.amount)} -> ${addrDisplay(resolutionState.recipient, roleAddresses)}`
                    : buildFallbackFinalTransfer(ds, policy, roleAddresses);
                  const decodedLastDelay = decodeCoordinatorDelay(policySettlementState.lastResponse);
                  const decodedLastError = decodeCoordinatorError(policySettlementState.lastError);
                  const isRefunding = refundingPolicyId === id;
                  const isSettling = settlingPolicyId === id;
                  const actionMessage = panelActionState.policyId === id ? panelActionState.msg : "";
                  const actionError = panelActionState.policyId === id ? panelActionState.err : "";
                  return (
                    <div
                      key={id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedPolicyId(prev => String(prev) === String(id) ? null : id)}
                      onKeyDown={e => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedPolicyId(prev => String(prev) === String(id) ? null : id);
                        }
                      }}
                      style={{ padding: "12px", background: "#0d0f14", borderRadius: 8, border: `1px solid ${isActiveSelection || isExpanded ? panelMeta.accent + "88" : "#2d3445"}`, width: "100%", textAlign: "left", cursor: "pointer" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ color: "#fff", fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>Policy #{id}</span>
                        <DerivedStatusBadge ds={ds} />
                      </div>
                      {shouldShowRelation && <div style={{ color: panelMeta.accent, fontSize: 12, marginBottom: 8 }}>{relation}</div>}
                      <div style={{ display: "grid", gap: 4, fontSize: 12 }}>
                        <div><span style={{ color: CLR.dim }}>Flight:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fromBytes32(policy.flightRef)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Scheduled Departure:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{tsToLocal(policy.departureTime)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Passenger:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{shortAddr(policy.passenger)}</span></div>
                        <div><span style={{ color: CLR.dim }}>Best Premium:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{bestPremium}</span></div>
                        <div><span style={{ color: CLR.dim }}>Best UW:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{addrDisplay(policy.bestUnderwriter, roleAddresses)}</span></div>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #253041", display: "grid", gap: 4, fontSize: 12 }}>
                          <div><span style={{ color: CLR.dim }}>Fixed Payout:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fmtEth(policy.fixedPayout)}</span></div>
                          <div><span style={{ color: CLR.dim }}>Delay Threshold:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{String(policy.delayThreshold)} min</span></div>
                          <div><span style={{ color: CLR.dim }}>Auction Ends:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{tsToLocal(policy.auctionEnd)}</span></div>
                          <div><span style={{ color: CLR.dim }}>Expiry:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{tsToLocal(policy.expiry)}</span></div>
                          <div><span style={{ color: CLR.dim }}>Max Premium:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{fmtEth(policy.maxPremium)}</span></div>
                          <div><span style={{ color: CLR.dim }}>Policy NFT:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{policy.policyNFTId > 0n ? `#${policy.policyNFTId}` : "(not minted)"}</span></div>
                          <div><span style={{ color: CLR.dim }}>Risk NFT:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{policy.riskNFTId > 0n ? `#${policy.riskNFTId}` : "(not minted)"}</span></div>
                          {(resolutionState || auctionState || decodedLastDelay !== null || ds === "PAID" || ds === "RESOLVED_ON_TIME" || ds === "UNBID_EXPIRED") && ds !== "REFUNDED_UNBID" && (
                            <div style={{ marginTop: 8, paddingTop: 10, borderTop: "1px solid #253041", display: "grid", gap: 4 }}>
                              <div style={{ color: panelMeta.accent, fontSize: 12, fontFamily: "monospace", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>
                                Settlement Summary
                              </div>
                              <div><span style={{ color: CLR.dim }}>Outcome:</span> <span style={{ color: CLR.value }}>{describeSettlementOutcome(ds, resolutionState, policy)}</span></div>
                              <div><span style={{ color: CLR.dim }}>Delay Used:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{decodedLastDelay === null ? "—" : `${decodedLastDelay} min`}</span></div>
                              <div><span style={{ color: CLR.dim }}>Final Transfer:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{finalTransferText}</span></div>
                              {resolutionState?.txHash && <div><span style={{ color: CLR.dim }}>Settlement Tx:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{shortAddr(resolutionState.txHash)}</span></div>}
                              {auctionState?.txHash && <div><span style={{ color: CLR.dim }}>Auction Finalized Tx:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{shortAddr(auctionState.txHash)}</span></div>}
                            </div>
                          )}
                          {shouldShowSettlementBlock && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ color: isSettlementUnlocked ? "#fcd34d" : "#94a3b8", fontSize: 12, marginBottom: 8, fontFamily: "monospace" }}>
                                {canRequestSettlementFromRightPanel
                                  ? isPendingForThisPolicy
                                    ? "Chainlink request is pending. Refreshing the page will keep showing this pending state."
                                    : anotherPolicyIsPending
                                      ? `Coordinator is currently processing Policy #${coordinatorStatus.pendingPolicyId}.`
                                      : isSettlementUnlocked
                                        ? "Ready to request Chainlink settlement."
                                        : `Settlement unlocks at ${tsToLocal(settlementUnlockTs)}.`
                                  : "Only the passenger or winning underwriter can request Chainlink settlement."}
                              </div>
                              <div style={{ display: "grid", gap: 4, marginBottom: 8, fontSize: 12 }}>
                                <div><span style={{ color: CLR.dim }}>Pending Request:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{policySettlementState.pendingRequestId !== ethers.ZeroHash ? shortAddr(policySettlementState.pendingRequestId) : "—"}</span></div>
                                <div><span style={{ color: CLR.dim }}>Last Request:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{policySettlementState.lastRequestId !== ethers.ZeroHash ? shortAddr(policySettlementState.lastRequestId) : "—"}</span></div>
                                <div><span style={{ color: CLR.dim }}>Last Delay:</span> <span style={{ color: CLR.value, fontFamily: "monospace" }}>{decodedLastDelay === null ? "—" : `${decodedLastDelay} min`}</span></div>
                                <div><span style={{ color: CLR.dim }}>Last Error:</span> <span style={{ color: decodedLastError ? "#fca5a5" : CLR.value, fontFamily: "monospace", wordBreak: "break-word" }}>{decodedLastError || "—"}</span></div>
                              </div>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  requestChainlinkSettlement(id, policy);
                                }}
                                disabled={!isSettlementUnlocked || isSettling || isPendingForThisPolicy}
                                style={isSettlementUnlocked && !isSettling ? btnStyle("#f59e0b") : disabledBtnStyle}
                              >
                                {isSettling || isPendingForThisPolicy ? "Requesting..." : "Request Chainlink Settlement"}
                              </button>
                              {(actionMessage || actionError) && <Log msg={actionMessage} err={actionError} />}
                            </div>
                          )}
                          {canRefundFromRightPanel && (
                            <div style={{ marginTop: 8 }}>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  refundExpiredPolicy(id);
                                }}
                                disabled={isRefunding}
                                style={isRefunding ? disabledBtnStyle : btnStyle("#fb7185")}
                              >
                                {isRefunding ? "Refunding..." : "Refund"}
                              </button>
                            </div>
                          )}
                          {(actionMessage || actionError) && !(shouldShowSettlementBlock || canRefundFromRightPanel) && <Log msg={actionMessage} err={actionError} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <h3 style={{ fontSize: 13, color: "#fff", marginTop: 25, marginBottom: 15 }}>ACTIVITY LOG</h3>
      {txLog.map(entry => (
        <div key={entry.id} style={{ fontSize: 11, background: "#111318", padding: "8px", borderRadius: 4, marginBottom: 5, borderLeft: `3px solid ${ROLE_META[entry.role]?.color || "#94a3b8"}` }}>
          <div style={{ color: "#fff" }}>{entry.action}</div>
          <div style={{ color: "#94a3b8" }}>{entry.timestamp}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [connLog, setConnLog] = useState("");
  const [network, setNetwork] = useState("");
  const [roleAddresses, setRoleAddresses] = useState(HARDHAT_DEFAULTS);
  const [activeMode, setActiveMode] = useState("passenger");
  const [currentPolicy, setCurrentPolicy] = useState(null);
  const [currentPolicyId, setCurrentPolicyId] = useState(null);
  const [nftOwners, setNftOwners] = useState(null);
  const [txLog, setTxLog] = useState([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const addTxLog = entry => setTxLog(prev => [entry, ...prev].slice(0, 20));
  const triggerBalanceRefresh = () => setRefreshTick(t => t + 1);
  
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = async (accounts) => {
      if (!accounts[0]) {
        setAccount(null);
        setContract(null);
        return;
      }
      setAccount(accounts[0]);
      const prov = new ethers.BrowserProvider(window.ethereum);
      const net = await prov.getNetwork();
      if (Number(net.chainId) !== EXPECTED_CHAIN_ID) {
        setContract(null);
        setConnLog(`Wrong network in MetaMask. Switch to ${ACTIVE_NETWORK_LABEL} (chainId ${EXPECTED_CHAIN_ID}).`);
        return;
      }
      if (!hasConfiguredAddress) {
        setContract(null);
        setConnLog(`Missing contract address for ${ACTIVE_NETWORK_LABEL}. Set it in frontend/.env and restart npm start.`);
        return;
      }
      const signer = await prov.getSigner();
      const nextContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setContract(nextContract);
      setConnLog("");
      try {
        const resolver = await (readOnlyContract ?? nextContract).resolver();
        setRoleAddresses(prev => ({ ...prev, resolver }));
        setActiveMode(resolver.toLowerCase() === accounts[0].toLowerCase() ? "resolver" : "passenger");
      } catch {}
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum.removeListener("accountsChanged", handler);
  }, []);

  async function connectWallet() {
    if (!window.ethereum) { setConnLog("MetaMask not found."); return; }
    try {
      const prov = new ethers.BrowserProvider(window.ethereum);
      const accounts = await prov.send("eth_requestAccounts", []);
      const net = await prov.getNetwork();
      if (Number(net.chainId) !== EXPECTED_CHAIN_ID) {
        setContract(null);
        setConnLog(`Wrong network in MetaMask. Switch to ${ACTIVE_NETWORK_LABEL} (chainId ${EXPECTED_CHAIN_ID}).`);
        return;
      }
      if (!hasConfiguredAddress) {
        setContract(null);
        setConnLog(`Missing contract address for ${ACTIVE_NETWORK_LABEL}. Set it in frontend/.env and restart npm start.`);
        return;
      }
      const signer = await prov.getSigner();
      const code = readProvider ? await readProvider.getCode(CONTRACT_ADDRESS) : await prov.getCode(CONTRACT_ADDRESS);
      setAccount(accounts[0]);
      setNetwork(`${net.name} (${net.chainId})`);
      if (code === "0x") {
        setContract(null);
        setConnLog(`No contract code found at ${CONTRACT_ADDRESS} on ${ACTIVE_NETWORK_LABEL}. Check your .env settings and redeploy if needed.`);
        return;
      }
      setConnLog("");
      const nextContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setContract(nextContract);
      try {
        const resolver = await (readOnlyContract ?? nextContract).resolver();
        setRoleAddresses(prev => ({ ...prev, resolver }));
        setActiveMode(resolver.toLowerCase() === accounts[0].toLowerCase() ? "resolver" : "passenger");
      } catch {}
    } catch (e) {
      setConnLog(parseError(e));
    }
  }

  const isResolverAccount = roleAddresses.resolver?.toLowerCase() === account?.toLowerCase();
  const availableModes = account ? [
    { key: "passenger", label: "Passenger", color: ROLE_META.passenger.color },
    { key: "underwriter", label: "Underwriter", color: ROLE_META.underwriter.color },
    { key: "syndicate", label: "Risk NFT Marketplace", color: ROLE_META.syndicate.color },
    ...(isResolverAccount ? [{ key: "resolver", label: "Resolver", color: ROLE_META.resolver.color }] : []),
  ] : [];
  const sharedProps = { contract, readContract: readOnlyContract, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account, refreshTick };

  return (
    <div style={{ height: "100vh", background: "#0a0c10", color: "#e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header style={{ height: 72, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1e2330" }}>
        <h1>Sky<span style={{ color: "#4fc3f7" }}>Hedge</span></h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {account && (
            <div style={{ display: "flex", gap: 8, padding: "6px", background: "#111318", border: "1px solid #2d3445", borderRadius: 10 }}>
              {availableModes.map(mode => (
                <button
                  key={mode.key}
                  onClick={() => setActiveMode(mode.key)}
                  style={activeMode === mode.key ? btnStyle(mode.color, { padding: "8px 14px" }) : { ...btnStyle("#94a3b8", { padding: "8px 14px" }), color: "#94a3b8", border: "1px solid #3d4455", background: "#1a1e2a" }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={connectWallet} style={btnStyle(account ? "#34d399" : "#4fc3f7")}>
            {account ? `Connected: ${shortAddr(account)}` : "Connect Wallet"}
          </button>
        </div>
      </header>
      {connLog && <div style={{ margin: "12px 20px 0", padding: "10px 14px", background: "#7c2d1222", border: "1px solid #ef444444", borderRadius: 6, color: "#fca5a5", fontSize: 13, fontFamily: "monospace" }}>⚠️ {connLog}</div>}

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flex: activeMode === "syndicate" ? 1 : 3, padding: "20px", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {!account ? (
            <div style={{ textAlign: "center", padding: "100px 0" }}>👋 Please connect wallet to start</div>
          ) : (
            <>
              {activeMode === "passenger" && <PassengerView sharedProps={sharedProps} />}
              {activeMode === "underwriter" && <UnderwriterView sharedProps={sharedProps} roleKey="underwriter" />}
              {activeMode === "syndicate" && <SyndicateView sharedProps={sharedProps} />}
              {activeMode === "resolver" && <ResolverView sharedProps={sharedProps} />}
            </>
          )}
        </div>
        {activeMode !== "syndicate" && (
          <RightPanel contract={contract} readContract={readOnlyContract} account={account} roleAddresses={roleAddresses} currentPolicyId={currentPolicyId} txLog={txLog} refreshTick={refreshTick} activeMode={activeMode} addTxLog={addTxLog} triggerBalanceRefresh={triggerBalanceRefresh} />
        )}
      </div>
    </div>
  );
}
