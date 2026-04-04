// scripts/deploy.js
// Usage:
//   Local:   npx hardhat run scripts/deploy.js --network localhost
//   Sepolia: npx hardhat run scripts/deploy.js --network sepolia

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(
    await hre.ethers.provider.getBalance(deployer.address)
  ), "ETH");

  // The deployer account is also set as the initial resolver (Oracle).
  // In a real deployment you'd pass a dedicated oracle address here.
  const resolverAddress = deployer.address;

  const SkyHedgeCore = await hre.ethers.getContractFactory("SkyHedgeCore");
  const contract = await SkyHedgeCore.deploy(resolverAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("\n✅ SkyHedgeCore deployed to:", address);
  console.log("   Resolver (Oracle) set to:", resolverAddress);
  console.log("\n📋 Next steps:");
  console.log("   1. Copy the contract address above.");
  console.log("   2. Paste it into frontend/src/config.js  →  CONTRACT_ADDRESS");
  console.log("   3. Copy ABI from artifacts/contracts/SkyHedgeCore.sol/SkyHedgeCore.json");
  console.log("      and paste it into frontend/src/abi/SkyHedgeCore.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
