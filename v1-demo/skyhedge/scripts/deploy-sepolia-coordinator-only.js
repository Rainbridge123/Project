const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseDonId(value) {
  return value.startsWith("0x") ? value : hre.ethers.encodeBytes32String(value);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const coreAddress =
    process.env.SKYHEDGE_SEPOLIA_CONTRACT_ADDRESS ||
    process.env.REACT_APP_SEPOLIA_CONTRACT_ADDRESS ||
    "";

  if (!coreAddress) {
    throw new Error(
      "Missing SKYHEDGE_SEPOLIA_CONTRACT_ADDRESS or REACT_APP_SEPOLIA_CONTRACT_ADDRESS in .env."
    );
  }

  const sourceCode = fs.readFileSync(
    path.join(__dirname, "..", "chainlink", "functions", "ciriumDelay.js"),
    "utf8"
  );

  const functionsRouter = requiredEnv("CHAINLINK_FUNCTIONS_ROUTER");
  const donId = parseDonId(requiredEnv("CHAINLINK_FUNCTIONS_DON_ID"));
  const subscriptionId = Number(requiredEnv("CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID"));
  const callbackGasLimit = Number(process.env.CHAINLINK_FUNCTIONS_CALLBACK_GAS_LIMIT || "300000");
  const secretsSlotId = process.env.CHAINLINK_FUNCTIONS_DON_SECRETS_SLOT_ID;
  const secretsVersion = process.env.CHAINLINK_FUNCTIONS_DON_SECRETS_VERSION;

  console.log("Deploying replacement Sepolia coordinator with:", deployer.address);
  console.log("Using existing core:", coreAddress);

  const core = await hre.ethers.getContractAt("SkyHedgeCoreChainlink", coreAddress, deployer);
  const CoordinatorFactory = await hre.ethers.getContractFactory("SkyHedgeOracleCoordinator");
  const coordinator = await CoordinatorFactory.deploy(
    coreAddress,
    functionsRouter,
    donId,
    subscriptionId,
    callbackGasLimit,
    sourceCode
  );
  await coordinator.waitForDeployment();

  const coordinatorAddress = await coordinator.getAddress();
  console.log("New coordinator deployed:", coordinatorAddress);

  const setTx = await core.setOracleCoordinator(coordinatorAddress);
  await setTx.wait();
  console.log("Core updated to use new coordinator:", setTx.hash);

  if (secretsSlotId && secretsVersion) {
    const secretsTx = await coordinator.setDONHostedSecrets(
      Number(secretsSlotId),
      Number(secretsVersion)
    );
    await secretsTx.wait();
    console.log(
      `DON-hosted secrets configured on new coordinator: slot=${Number(secretsSlotId)}, version=${Number(secretsVersion)}`
    );
  } else {
    console.log("DON-hosted secrets were not configured because slot/version are missing.");
  }

  console.log("\nNext steps:");
  console.log("1. Add this new coordinator as a consumer on your Chainlink Functions subscription.");
  console.log("2. Update or recreate your Chainlink Automation upkeep to point at the new coordinator.");
  console.log("3. Save this address into root .env as SKYHEDGE_SEPOLIA_COORDINATOR_ADDRESS.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
