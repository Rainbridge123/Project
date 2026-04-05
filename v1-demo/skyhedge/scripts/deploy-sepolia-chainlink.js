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
  const sourceCode = fs.readFileSync(
    path.join(__dirname, "..", "chainlink", "functions", "aviationDelay.js"),
    "utf8"
  );

  const functionsRouter = requiredEnv("CHAINLINK_FUNCTIONS_ROUTER");
  const donId = parseDonId(requiredEnv("CHAINLINK_FUNCTIONS_DON_ID"));
  const subscriptionId = Number(requiredEnv("CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID"));
  const callbackGasLimit = Number(process.env.CHAINLINK_FUNCTIONS_CALLBACK_GAS_LIMIT || "300000");
  const secretsSlotId = process.env.CHAINLINK_FUNCTIONS_DON_SECRETS_SLOT_ID;
  const secretsVersion = process.env.CHAINLINK_FUNCTIONS_DON_SECRETS_VERSION;

  console.log("Deploying Chainlink Sepolia setup with:", deployer.address);

  const CoreFactory = await hre.ethers.getContractFactory("SkyHedgeCoreChainlink");
  const core = await CoreFactory.deploy(deployer.address);
  await core.waitForDeployment();

  const CoordinatorFactory = await hre.ethers.getContractFactory("SkyHedgeOracleCoordinator");
  const coordinator = await CoordinatorFactory.deploy(
    await core.getAddress(),
    functionsRouter,
    donId,
    subscriptionId,
    callbackGasLimit,
    sourceCode
  );
  await coordinator.waitForDeployment();

  const setTx = await core.setOracleCoordinator(await coordinator.getAddress());
  await setTx.wait();

  if (secretsSlotId && secretsVersion) {
    const secretsTx = await coordinator.setDONHostedSecrets(
      Number(secretsSlotId),
      Number(secretsVersion)
    );
    await secretsTx.wait();
  }

  console.log("\n✅ SkyHedgeCoreChainlink deployed to:", await core.getAddress());
  console.log("✅ SkyHedgeOracleCoordinator deployed to:", await coordinator.getAddress());
  console.log("   Functions router:", functionsRouter);
  console.log("   DON ID:", donId);
  console.log("   Subscription ID:", subscriptionId);
  console.log("   Callback gas limit:", callbackGasLimit);
  if (secretsSlotId && secretsVersion) {
    console.log("   DON-hosted secrets slot:", Number(secretsSlotId));
    console.log("   DON-hosted secrets version:", Number(secretsVersion));
  } else {
    console.log("   DON-hosted secrets:", "(not configured yet)");
  }
  console.log("\n📋 Next steps:");
  console.log("   1. Fund the Functions subscription with LINK.");
  console.log("   2. Add the coordinator contract as a consumer on that subscription.");
  console.log("   3. Upload DON-hosted secrets and record the slot ID + version.");
  console.log("   4. Register the coordinator as a Chainlink Automation upkeep.");
  console.log("   5. Put the core address into frontend/.env as REACT_APP_SEPOLIA_CONTRACT_ADDRESS.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
