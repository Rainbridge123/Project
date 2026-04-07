const dotenv = require("dotenv");

dotenv.config();

let SecretsManager;
let ethers;
try {
  ({ SecretsManager } = require("@chainlink/functions-toolkit"));
  ({ ethers } = require("@chainlink/functions-toolkit/node_modules/ethers"));
} catch (error) {
  console.error("Missing compatible Chainlink Functions dependencies.");
  console.error("Install them with: npm install @chainlink/functions-toolkit");
  process.exit(1);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePositiveInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
  }
  return value;
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(requiredEnv("ALCHEMY_SEPOLIA_URL"));
  const signer = new ethers.Wallet(requiredEnv("PRIVATE_KEY_DEPLOYER"), provider);

  const functionsRouterAddress = requiredEnv("CHAINLINK_FUNCTIONS_ROUTER");
  const donId = requiredEnv("CHAINLINK_FUNCTIONS_DON_ID");
  const apiToken = requiredEnv("CIRIUM_API_TOKEN");

  const slotId = parsePositiveInt("CHAINLINK_FUNCTIONS_DON_SECRETS_SLOT_ID", 0);
  const minutesUntilExpiration = parsePositiveInt("CHAINLINK_FUNCTIONS_DON_SECRETS_TTL_MINUTES", 1440);

  if (minutesUntilExpiration < 5) {
    throw new Error("CHAINLINK_FUNCTIONS_DON_SECRETS_TTL_MINUTES must be at least 5");
  }

  const gatewayUrls = (
    process.env.CHAINLINK_FUNCTIONS_GATEWAY_URLS ||
    "https://01.functions-gateway.testnet.chain.link/,https://02.functions-gateway.testnet.chain.link/"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (gatewayUrls.length === 0) {
    throw new Error("No gateway URLs configured");
  }

  const secretsManager = new SecretsManager({
    signer,
    functionsRouterAddress,
    donId,
  });

  await secretsManager.initialize();

  const encryptedSecretsObj = await secretsManager.encryptSecrets({
    apiToken,
  });

  const result = await secretsManager.uploadEncryptedSecretsToDON({
    encryptedSecretsHexstring: encryptedSecretsObj.encryptedSecrets,
    gatewayUrls,
    slotId,
    minutesUntilExpiration,
  });

  console.log("DON-hosted secrets uploaded.");
  console.log(`slotId=${slotId}`);
  console.log(`version=${result.version}`);
  console.log(`success=${result.success}`);
  console.log("");
  console.log("Add these to your root .env:");
  console.log(`CHAINLINK_FUNCTIONS_DON_SECRETS_SLOT_ID=${slotId}`);
  console.log(`CHAINLINK_FUNCTIONS_DON_SECRETS_VERSION=${result.version}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
