import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { ACTIVE_NETWORK_KEY, ACTIVE_NETWORK_LABEL, CONTRACT_ADDRESS, ABI, COORDINATOR_ABI, STATUS, READ_RPC_URL, DEPLOY_BLOCK, EXPECTED_CHAIN_ID, AVIATIONSTACK_API_KEY, AVIATIONSTACK_BASE_URL } from "./config";

const hasConfiguredAddress = Boolean(CONTRACT_ADDRESS) && ethers.isAddress(CONTRACT_ADDRESS);
const readProvider = READ_RPC_URL ? new ethers.JsonRpcProvider(READ_RPC_URL) : null;
const readOnlyContract = readProvider && hasConfiguredAddress ? new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider) : null;
const BROWSER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
const DEFAULT_FLIGHT_LOOKUP = {
  flightRef: "SQ322",
  airline: "Singapore Airlines",
  flight_date: "2026-04-05",
  flight_status: "scheduled",
  departure_airport: "Singapore Changi",
  departure_timezone: "Asia/Singapore",
  departure_iata: "SIN",
  departure_terminal: "3",
  departure_scheduled: "2026-04-05T23:00:00+00:00",
  departure_estimated: "2026-04-05T23:00:00+00:00",
  departure_actual: null,
  departure_delay_mins: null,
  arrival_airport: "Heathrow",
  arrival_timezone: "Europe/London",
  arrival_iata: "LHR",
  arrival_terminal: "2",
  arrival_scheduled: "2026-04-06T05:55:00+00:00",
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
  if (s === 3) return "EXPIRED";
  return "UNKNOWN";
}
const DERIVED_META = {
  BIDDING_OPEN:  { label: "BIDDING — OPEN",  color: "#f59e0b", desc: "Auction open. Underwriters can place bids now." },
  BIDDING_ENDED: { label: "BIDDING — ENDED", color: "#ef4444", desc: "Auction closed. Winning underwriter must finalize." },
  UNBID_EXPIRED: { label: "EXPIRED",         color: "#fb7185", desc: "No bids were placed. Passenger refund is still pending." },
  ACTIVE:        { label: "ACTIVE",           color: "#3b82f6", desc: "Collateral locked. Awaiting oracle resolution." },
  PAID:          { label: "PAID",             color: "#22c55e", desc: "Flight delayed. Payout sent to Policy NFT holder." },
  EXPIRED:       { label: "REFUNDED",         color: "#6b7280", desc: "Funds have already been returned to the rightful holder." },
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
function getCoordinatorContract(contract, coordinatorAddress) {
  if (!contract || !coordinatorAddress || !ethers.isAddress(coordinatorAddress)) return null;
  return new ethers.Contract(coordinatorAddress, COORDINATOR_ABI, contract.runner);
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
function normalizeFlightLookupResponse(payload, fallbackFlightRef = "") {
  const raw = Array.isArray(payload?.data) ? payload.data[0] : payload;
  if (!raw) return null;
  const normalized = {
    flightRef: upperFlightRef(raw.flightRef || raw.flight?.iata || raw.flight?.icao || fallbackFlightRef),
    airline: readTextValue(raw.airline?.name || raw.airline, "Unknown airline"),
    flight_date: readTextValue(raw.flight_date, ""),
    flight_status: readTextValue(raw.flight_status, "unknown"),
    departure_airport: readTextValue(raw.departure_airport || raw.departure?.airport, ""),
    departure_timezone: readTextValue(raw.departure_timezone || raw.departure?.timezone, ""),
    departure_iata: readTextValue(raw.departure_iata || raw.departure?.iata, ""),
    departure_terminal: readTextValue(raw.departure_terminal || raw.departure?.terminal, ""),
    departure_scheduled: raw.departure_scheduled || raw.departure?.scheduled || null,
    departure_estimated: raw.departure_estimated || raw.departure?.estimated || null,
    departure_actual: raw.departure_actual || raw.departure?.actual || null,
    departure_delay_mins: raw.departure_delay_mins ?? raw.departure?.delay ?? null,
    arrival_airport: readTextValue(raw.arrival_airport || raw.arrival?.airport, ""),
    arrival_timezone: readTextValue(raw.arrival_timezone || raw.arrival?.timezone, ""),
    arrival_iata: readTextValue(raw.arrival_iata || raw.arrival?.iata, ""),
    arrival_terminal: readTextValue(raw.arrival_terminal || raw.arrival?.terminal, ""),
    arrival_scheduled: raw.arrival_scheduled || raw.arrival?.scheduled || null,
    arrival_estimated: raw.arrival_estimated || raw.arrival?.estimated || null,
    arrival_actual: raw.arrival_actual || raw.arrival?.actual || null,
    arrival_delay_mins: raw.arrival_delay_mins ?? raw.arrival?.delay ?? null,
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
async function fetchFlightLookupData(flightRef) {
  const normalizedFlightRef = upperFlightRef(flightRef);
  if (!normalizedFlightRef) throw new Error("Flight number is required.");
  if (!AVIATIONSTACK_API_KEY) throw new Error("Missing REACT_APP_AVIATIONSTACK_API_KEY in frontend/.env.");

  const params = new URLSearchParams({
    access_key: AVIATIONSTACK_API_KEY,
    flight_iata: normalizedFlightRef,
    limit: "1",
  });
  const response = await fetch(`${AVIATIONSTACK_BASE_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`AviationStack request failed with ${response.status}.`);
  }
  const payload = await response.json();
  if (payload?.error?.message || payload?.error?.info) {
    throw new Error(payload.error.message || payload.error.info);
  }
  const normalizedFlight = normalizeFlightLookupResponse(payload, normalizedFlightRef);
  if (!normalizedFlight) {
    throw new Error(`No flight data found for ${normalizedFlightRef}.`);
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
const STATUS_PRIORITY = { ACTIVE: 0, UNBID_EXPIRED: 1, BIDDING_OPEN: 2, BIDDING_ENDED: 3, PAID: 4, EXPIRED: 5, UNKNOWN: 6 };
const RIGHT_PANEL_STATUS_GROUPS = [
  { key: "ACTIVE", title: "Active" },
  { key: "UNBID_EXPIRED", title: "Expired" },
  { key: "BIDDING_OPEN", title: "Bidding Open" },
  { key: "BIDDING_ENDED", title: "Bidding Ended" },
  { key: "PAID", title: "Paid" },
  { key: "EXPIRED", title: "Refunded" },
  { key: "UNKNOWN", title: "Other" },
];

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
    const key = grouped.has(entry.ds) ? entry.ds : "UNKNOWN";
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
  const [form, setForm] = useState({ flightRef: DEFAULT_FLIGHT_LOOKUP.flightRef, departureTime: defaultDepartureTime, delayThreshold: "60", fixedPayout: "0.5", maxPremium: "0.05", auctionEnd: nowPlusSeconds(120), expiry: defaultDepartureTime });
  const [log, setLog] = useState({ msg: "", err: "" });
  const [policyId, setPolicyId] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [tForm, setTForm] = useState({ to: "", nftId: "" });
  const [tLog, setTLog] = useState({ msg: "", err: "" });
  const [flightQuery, setFlightQuery] = useState(DEFAULT_FLIGHT_LOOKUP.flightRef);
  const [flightInfo, setFlightInfo] = useState(DEFAULT_FLIGHT_LOOKUP);
  const [isManualFlightEntry, setIsManualFlightEntry] = useState(false);
  const [flightCache, setFlightCache] = useState({ [DEFAULT_FLIGHT_LOOKUP.flightRef]: DEFAULT_FLIGHT_LOOKUP });
  const [flightLookupLog, setFlightLookupLog] = useState({ msg: "", err: "" });
  const [isFlightLookupLoading, setIsFlightLookupLoading] = useState(false);
  const normalizedFlightStatus = normalizeFlightStatus(flightInfo.flight_status);
  const canCreatePolicy = isManualFlightEntry || normalizedFlightStatus === "scheduled";
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
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
    const normalizedFlightRef = upperFlightRef(flightQuery);
    if (!normalizedFlightRef) {
      setFlightLookupLog({ msg: "", err: "Please enter a flight number first." });
      return;
    }

    if (flightCache[normalizedFlightRef]) {
      const cachedFlight = flightCache[normalizedFlightRef];
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
      setFlightLookupLog({ msg: `Loaded ${normalizedFlightRef} from local cache.`, err: "" });
      return;
    }

    if (!AVIATIONSTACK_API_KEY) {
      enableManualEntry(normalizedFlightRef);
      setFlightLookupLog({ msg: "", err: "Missing REACT_APP_AVIATIONSTACK_API_KEY in frontend/.env. Manual entry is now enabled." });
      return;
    }

    setIsFlightLookupLoading(true);
    setFlightLookupLog({ msg: `Looking up ${normalizedFlightRef}...`, err: "" });
    try {
      const normalizedFlight = await fetchFlightLookupData(normalizedFlightRef);
      setFlightCache(prev => ({ ...prev, [normalizedFlightRef]: normalizedFlight }));
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
      setFlightLookupLog({ msg: `Loaded ${normalizedFlight.flightRef}. Departure time has been filled into the policy form.`, err: "" });
    } catch (e) {
      enableManualEntry(normalizedFlightRef);
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
          <div style={{ display: "flex", gap: 8, width: "min(100%, 360px)", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input
              value={flightQuery}
              onChange={e => setFlightQuery(upperFlightRef(e.target.value))}
              onKeyDown={e => { if (e.key === "Enter") lookupFlight(); }}
              placeholder="e.g. SQ322"
              style={{ ...inputStyle, flex: "1 1 220px" }}
            />
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
    setIsResolving(true);
    setLog({ msg: "Fetching delay data from AviationStack...", err: "" });
    try {
      const flightInfo = await fetchFlightLookupData(flightRef);
      const delayDetails = pickFlightDelayDetails(flightInfo);
      if (delayDetails.delayMins === null) {
        throw new Error(`AviationStack did not return a usable delay field for ${flightRef} yet.`);
      }
      const tx = await contract.resolvePolicy(policyId, delayDetails.delayMins);
      await tx.wait();
      addTxLog(buildTxLog("resolver", `Resolved Policy #${policyId} from AviationStack ${delayDetails.source} = ${delayDetails.delayMins} min`));
      setLog({ msg: `Resolved from AviationStack. ${delayDetails.source} reported ${delayDetails.delayMins} minutes of delay.`, err: "" });
      loadPolicy(); fetchPolicies(); triggerBalanceRefresh();
    } catch (e) { setLog({ msg: "", err: parseError(e) }); }
    finally { setIsResolving(false); }
  }

  const resolveAfterTs = policy ? settlementReadyTs(policy) : 0;
  const resolveWindowMessage = policy
    ? canResolve
      ? "Resolve is unlocked. Clicking the button will fetch the delay field from AviationStack."
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
        subtitle="Resolver cannot enter delay minutes manually. Resolve uses AviationStack delay data."
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
                      : ds === "PAID" || ds === "EXPIRED"
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
                    : ds === "PAID" || ds === "EXPIRED"
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

      const activePolicyIds = relatedPolicies
        .filter(({ ds }) => ds === "ACTIVE")
        .map(({ id }) => Number(id));

      if (!activePolicyIds.length) {
        if (!cancelled) setPolicySettlementStates({});
        return;
      }

      try {
        const entries = await Promise.all(
          activePolicyIds.map(async (id) => {
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
    ...(isResolverAccount ? [{ key: "resolver", label: "Resolver", color: ROLE_META.resolver.color }] : []),
  ] : [];
  const sharedProps = { contract, readContract: readOnlyContract, addTxLog, setCurrentPolicy, setCurrentPolicyId, setNftOwners, roleAddresses, triggerBalanceRefresh, account };

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
        <div style={{ flex: 3, padding: "20px", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {!account ? (
            <div style={{ textAlign: "center", padding: "100px 0" }}>👋 Please connect wallet to start</div>
          ) : (
            <>
              {activeMode === "passenger" && <PassengerView sharedProps={sharedProps} />}
              {activeMode === "underwriter" && <UnderwriterView sharedProps={sharedProps} roleKey="underwriter" />}
              {activeMode === "resolver" && <ResolverView sharedProps={sharedProps} />}
            </>
          )}
        </div>
        <RightPanel contract={contract} readContract={readOnlyContract} account={account} roleAddresses={roleAddresses} currentPolicyId={currentPolicyId} txLog={txLog} refreshTick={refreshTick} activeMode={activeMode} addTxLog={addTxLog} triggerBalanceRefresh={triggerBalanceRefresh} />
      </div>
    </div>
  );
}
