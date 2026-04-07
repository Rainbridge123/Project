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

function requiredNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
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
  const policyId = requiredNumber(
    cliArgs["policy-id"] || process.env.VAULT_POLICY_ID,
    "policy id"
  );
  const sharesForSale = requiredNumber(
    cliArgs["shares-for-sale"] || process.env.VAULT_SHARES_FOR_SALE,
    "shares for sale"
  );
  const coreAddress = resolveCoreAddress(cliArgs);
  const pricePerShareInput = cliArgs["price-per-share"] || process.env.VAULT_PRICE_PER_SHARE;

  if (!coreAddress || !hre.ethers.isAddress(coreAddress)) {
    throw new Error(
      "Missing valid core address. Pass --core-address <address> or set SKYHEDGE_CORE_ADDRESS / SKYHEDGE_SEPOLIA_CONTRACT_ADDRESS."
    );
  }
  if (!pricePerShareInput) {
    throw new Error("Missing price per share. Pass --price-per-share <eth> or set VAULT_PRICE_PER_SHARE.");
  }

  const pricePerShare = hre.ethers.parseEther(pricePerShareInput);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying PerPolicyRiskVault with:", deployer.address);
  console.log("Using core:", coreAddress);
  console.log("Using policyId:", policyId);
  console.log("Using sharesForSale:", sharesForSale);
  console.log("Using pricePerShare:", pricePerShareInput, "ETH");

  const VaultFactory = await hre.ethers.getContractFactory("PerPolicyRiskVault");
  const vault = await VaultFactory.deploy(
    coreAddress,
    policyId,
    deployer.address,
    hre.ethers.ZeroAddress,
    sharesForSale,
    pricePerShare
  );
  await vault.waitForDeployment();
  const core = await hre.ethers.getContractAt("SkyHedgeCoreChainlink", coreAddress);

  const vaultAddress = await vault.getAddress();
  const policy = await core.getPolicy(policyId);
  console.log("\n✅ PerPolicyRiskVault deployed to:", vaultAddress);
  console.log("   Lead underwriter:", deployer.address);
  console.log("   Bound core:", coreAddress);
  console.log("   Bound policyId:", policyId);
  console.log("   Bound riskNFTId:", policy.riskNFTId.toString());
  console.log("   Shares for sale:", sharesForSale);
  console.log("   Price per share:", pricePerShareInput, "ETH");

  console.log("\n📋 Next steps:");
  console.log("   1. From the winning underwriter wallet, transfer the Risk NFT into this vault:");
  console.log(`      safeTransferFrom(<underwriter>, ${vaultAddress}, ${policy.riskNFTId.toString()})`);
  console.log("   2. Let other underwriters call buyShares(amount).");
  console.log("   3. Listing terms are fixed after launch in the simplified flow.");
  console.log("   4. After policy resolution, call captureResolution() and then claimReward().");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
