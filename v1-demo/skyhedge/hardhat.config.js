require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    // ── Local Hardhat node (npx hardhat node) ─────────────────────
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    // ── Sepolia testnet ───────────────────────────────────────────
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_URL || "",
      accounts: process.env.PRIVATE_KEY_DEPLOYER
        ? [process.env.PRIVATE_KEY_DEPLOYER]
        : []
    }
  },
  // Optional: uncomment after deploying to Sepolia for contract verification
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY
  // }
};
