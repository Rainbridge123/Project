const hre = require("hardhat");

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    i += 1;
  }
  return parsed;
}

function resolveCoreAddress(cliArgs) {
  return (
    cliArgs["core-address"] ||
    process.env.SKYHEDGE_CORE_ADDRESS ||
    process.env.SKYHEDGE_SEPOLIA_CONTRACT_ADDRESS ||
    process.env.REACT_APP_SEPOLIA_CONTRACT_ADDRESS
  );
}

async function main() {
  const cliArgs = parseArgs(process.argv.slice(2));
  const coreAddress = resolveCoreAddress(cliArgs);

  if (!coreAddress || !hre.ethers.isAddress(coreAddress)) {
    throw new Error(
      "Missing valid core address. Pass --core-address <address> or set SKYHEDGE_CORE_ADDRESS / SKYHEDGE_SEPOLIA_CONTRACT_ADDRESS."
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying RiskSyndicateManager with:", deployer.address);
  console.log("Using core:", coreAddress);

  const ManagerFactory = await hre.ethers.getContractFactory("RiskSyndicateManager");
  const manager = await ManagerFactory.deploy(coreAddress);
  await manager.waitForDeployment();

  const managerAddress = await manager.getAddress();
  console.log("\n✅ RiskSyndicateManager deployed to:", managerAddress);
  console.log("   Bound core:", coreAddress);

  console.log("\n📋 Next steps:");
  console.log("   1. Save this address in frontend/.env as the active syndicate manager address.");
  console.log("   2. In the frontend, the winning underwriter can transfer a Risk NFT to this manager");
  console.log("      using safeTransferFrom(..., managerAddress, riskNftId, launchData).");
  console.log("   3. launchData should encode (sharesForSale, pricePerShare).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
