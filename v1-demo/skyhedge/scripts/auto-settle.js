const path = require("path");
const dotenv = require("dotenv");
const hre = require("hardhat");

const { ethers, network } = hre;

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "frontend", ".env"), override: false });

const ACTIVE_STATUS = 1n;
const DEFAULT_POLL_MS = 60_000;
const ONCE_MODE = process.env.AUTO_SETTLE_ONCE === "true" || process.argv.includes("--once");

function parsePollMs(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 5_000 ? parsed : DEFAULT_POLL_MS;
}

function getConfig() {
  const apiKey = process.env.AVIATIONSTACK_API_KEY || process.env.REACT_APP_AVIATIONSTACK_API_KEY || "";
  const apiBaseUrl =
    process.env.AVIATIONSTACK_BASE_URL ||
    process.env.REACT_APP_AVIATIONSTACK_BASE_URL ||
    "https://api.aviationstack.com/v1/flights";
  const pollMs = parsePollMs(process.env.AUTO_SETTLE_POLL_MS);

  const contractAddress =
    process.env.SKYHEDGE_CONTRACT_ADDRESS ||
    (network.name === "localhost"
      ? process.env.SKYHEDGE_LOCAL_CONTRACT_ADDRESS || process.env.REACT_APP_LOCAL_CONTRACT_ADDRESS
      : network.name === "sepolia"
        ? process.env.SKYHEDGE_SEPOLIA_CONTRACT_ADDRESS || process.env.REACT_APP_SEPOLIA_CONTRACT_ADDRESS
        : "");

  if (!contractAddress) {
    throw new Error(`Missing contract address for network "${network.name}".`);
  }

  if (!apiKey) {
    throw new Error("Missing AviationStack API key. Set AVIATIONSTACK_API_KEY or REACT_APP_AVIATIONSTACK_API_KEY.");
  }

  return { apiKey, apiBaseUrl, pollMs, contractAddress };
}

function decodeFlightRef(rawFlightRef) {
  if (!rawFlightRef) return "";
  try {
    return ethers.decodeBytes32String(rawFlightRef).trim();
  } catch {
    return ethers.toUtf8String(rawFlightRef).replace(/\0/g, "").trim();
  }
}

function readDelayValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function pickDelayInfo(record) {
  const departureDelay = readDelayValue(record?.departure?.delay ?? record?.departure_delay_mins ?? record?.departure_delay);
  if (departureDelay !== null) {
    return { delayMins: departureDelay, source: "departure.delay" };
  }

  const arrivalDelay = readDelayValue(record?.arrival?.delay ?? record?.arrival_delay_mins ?? record?.arrival_delay);
  if (arrivalDelay !== null) {
    return { delayMins: arrivalDelay, source: "arrival.delay" };
  }

  return { delayMins: null, source: "none" };
}

function pickFlightRecord(payload, flightRef) {
  const records = Array.isArray(payload?.data) ? payload.data : [];
  if (!records.length) return null;

  const normalizedFlightRef = String(flightRef).toUpperCase();
  const exactMatch = records.find((entry) => {
    const iata = String(entry?.flight?.iata || entry?.flightRef || "").toUpperCase();
    return iata === normalizedFlightRef;
  });

  return exactMatch || records[0];
}

async function fetchFlightSnapshot(flightRef, config) {
  const url = new URL(config.apiBaseUrl);
  url.searchParams.set("access_key", config.apiKey);
  url.searchParams.set("flight_iata", flightRef);
  url.searchParams.set("limit", "1");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`AviationStack request failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.error) {
    throw new Error(payload.error.info || "AviationStack returned an error response.");
  }

  const record = pickFlightRecord(payload, flightRef);
  if (!record) {
    return { found: false, flightRef, delayMins: null, source: "none", status: "not_found" };
  }

  const delayInfo = pickDelayInfo(record);
  return {
    found: true,
    flightRef,
    delayMins: delayInfo.delayMins,
    source: delayInfo.source,
    status: String(record.flight_status || "").toLowerCase(),
  };
}

async function loadDueActivePolicies(contract, nowTs) {
  const totalPolicies = Number(await contract.policyCount());
  const duePolicies = [];

  for (let policyId = 1; policyId <= totalPolicies; policyId += 1) {
    const policy = await contract.getPolicy(policyId);
    if (BigInt(policy.status) !== ACTIVE_STATUS) continue;

    const dueAt = BigInt(policy.departureTime) + (BigInt(policy.delayThreshold) * 60n);
    if (nowTs < dueAt) continue;

    duePolicies.push({
      policyId,
      policy,
      dueAt,
      flightRef: decodeFlightRef(policy.flightRef),
    });
  }

  return duePolicies;
}

async function resolveDuePolicies(contract, config) {
  const latestBlock = await ethers.provider.getBlock("latest");
  const nowTs = BigInt(latestBlock.timestamp);
  const duePolicies = await loadDueActivePolicies(contract, nowTs);

  if (!duePolicies.length) {
    console.log(`[${new Date().toISOString()}] No ACTIVE policies are ready for settlement yet.`);
    return;
  }

  console.log(`[${new Date().toISOString()}] Found ${duePolicies.length} ACTIVE policy/policies ready for settlement.`);

  const flightCache = new Map();

  for (const entry of duePolicies) {
    if (!entry.flightRef) {
      console.log(`- Policy #${entry.policyId}: skipped because flightRef is empty.`);
      continue;
    }

    if (!flightCache.has(entry.flightRef)) {
      try {
        const snapshot = await fetchFlightSnapshot(entry.flightRef, config);
        flightCache.set(entry.flightRef, snapshot);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        flightCache.set(entry.flightRef, { found: false, delayMins: null, source: "error", status: "error", error: message });
      }
    }

    const snapshot = flightCache.get(entry.flightRef);

    if (!snapshot?.found) {
      console.log(`- Policy #${entry.policyId}: skipped because flight ${entry.flightRef} could not be loaded (${snapshot?.error || "not found"}).`);
      continue;
    }

    if (snapshot.delayMins === null) {
      console.log(`- Policy #${entry.policyId}: flight ${entry.flightRef} loaded, but no usable delay field is available yet (status: ${snapshot.status || "unknown"}).`);
      continue;
    }

    try {
      const tx = await contract.resolvePolicy(entry.policyId, snapshot.delayMins);
      const receipt = await tx.wait();
      console.log(
        `- Policy #${entry.policyId}: resolved with ${snapshot.delayMins} min delay from ${snapshot.source} ` +
        `(flight status: ${snapshot.status || "unknown"}, tx: ${receipt.hash}).`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`- Policy #${entry.policyId}: resolve failed (${message}).`);
    }
  }
}

async function main() {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is unavailable. Use Node.js 18 or newer.");
  }

  const config = getConfig();
  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("SkyHedgeCore", config.contractAddress, signer);
  const resolverAddress = String(await contract.resolver()).toLowerCase();
  const signerAddress = String(signer.address).toLowerCase();

  if (resolverAddress !== signerAddress) {
    throw new Error(
      `Connected signer ${signer.address} is not the contract resolver ${await contract.resolver()}. ` +
      "Run the worker with the resolver account."
    );
  }

  console.log(`Auto-settlement worker connected on ${network.name}.`);
  console.log(`Contract: ${config.contractAddress}`);
  console.log(`Resolver: ${signer.address}`);
  console.log(`Poll interval: ${config.pollMs} ms`);

  do {
    await resolveDuePolicies(contract, config);

    if (ONCE_MODE) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollMs));
  } while (true);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
