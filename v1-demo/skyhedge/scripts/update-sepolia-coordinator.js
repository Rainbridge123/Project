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

function optionalPositiveInt(name) {
  const raw = process.env[name];
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid integer for ${name}: ${raw}`);
  }
  return parsed;
}

async function main() {
  const coordinatorAddress =
    process.env.SKYHEDGE_SEPOLIA_COORDINATOR_ADDRESS ||
    process.env.CHAINLINK_COORDINATOR_ADDRESS ||
    "";

  if (!coordinatorAddress) {
    throw new Error(
      "Missing SKYHEDGE_SEPOLIA_COORDINATOR_ADDRESS (or CHAINLINK_COORDINATOR_ADDRESS) in root .env."
    );
  }

  const [signer] = await hre.ethers.getSigners();
  const coordinator = await hre.ethers.getContractAt("SkyHedgeOracleCoordinator", coordinatorAddress, signer);
  const sourceCode = fs.readFileSync(
    path.join(__dirname, "..", "chainlink", "functions", "ciriumDelay.js"),
    "utf8"
  );

  console.log(`Updating coordinator on Sepolia: ${coordinatorAddress}`);
  console.log(`Signer: ${signer.address}`);

  const currentSourceCode = await coordinator.sourceCode();
  if (currentSourceCode !== sourceCode) {
    console.log("Updating Functions source code...");
    const tx = await coordinator.setSourceCode(sourceCode);
    await tx.wait();
    console.log(`Source code updated: ${tx.hash}`);
  } else {
    console.log("Functions source code is already up to date.");
  }

  const slotId = optionalPositiveInt("CHAINLINK_FUNCTIONS_DON_SECRETS_SLOT_ID");
  const version = optionalPositiveInt("CHAINLINK_FUNCTIONS_DON_SECRETS_VERSION");

  if (slotId !== null && version !== null) {
    const currentSlotId = Number(await coordinator.donHostedSecretsSlotId());
    const currentVersion = Number(await coordinator.donHostedSecretsVersion());

    if (currentSlotId !== slotId || currentVersion !== version) {
      console.log(`Updating DON-hosted secrets to slot=${slotId}, version=${version}...`);
      const tx = await coordinator.setDONHostedSecrets(slotId, version);
      await tx.wait();
      console.log(`DON-hosted secrets updated: ${tx.hash}`);
    } else {
      console.log("DON-hosted secrets config is already up to date.");
    }
  } else {
    console.log("Skipping DON-hosted secrets update because slot/version are not both set in .env.");
  }

  console.log("Coordinator update complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
