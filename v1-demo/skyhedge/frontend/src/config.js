// frontend/src/config.js
function parseBlockNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const NETWORKS = {
  localhost: {
    key: "localhost",
    label: "Hardhat Local",
    chainId: 31337,
    contractAddress: process.env.REACT_APP_LOCAL_CONTRACT_ADDRESS || "",
    readRpcUrl: process.env.REACT_APP_LOCAL_RPC_URL || "http://127.0.0.1:8545",
    deployBlock: parseBlockNumber(process.env.REACT_APP_LOCAL_DEPLOY_BLOCK, 0),
  },
  sepolia: {
    key: "sepolia",
    label: "Sepolia",
    chainId: 11155111,
    contractAddress: process.env.REACT_APP_SEPOLIA_CONTRACT_ADDRESS || "0x492f741eFD472dEe814DC82A51247DB4C6d80dAf",
    readRpcUrl: process.env.REACT_APP_SEPOLIA_RPC_URL || "",
    deployBlock: parseBlockNumber(process.env.REACT_APP_SEPOLIA_DEPLOY_BLOCK, 10587628),
  },
};

const requestedNetwork = process.env.REACT_APP_NETWORK || "localhost";

export const ACTIVE_NETWORK = NETWORKS[requestedNetwork] || NETWORKS.localhost;
export const ACTIVE_NETWORK_KEY = ACTIVE_NETWORK.key;
export const ACTIVE_NETWORK_LABEL = ACTIVE_NETWORK.label;
export const EXPECTED_CHAIN_ID = ACTIVE_NETWORK.chainId;
export const CONTRACT_ADDRESS = ACTIVE_NETWORK.contractAddress;
export const READ_RPC_URL = ACTIVE_NETWORK.readRpcUrl;
export const DEPLOY_BLOCK = ACTIVE_NETWORK.deployBlock;
export const AVIATIONSTACK_API_KEY = process.env.REACT_APP_AVIATIONSTACK_API_KEY || "";
export const AVIATIONSTACK_BASE_URL = process.env.REACT_APP_AVIATIONSTACK_BASE_URL || "https://api.aviationstack.com/v1/flights";
export const COORDINATOR_ABI = [
  "function requestPolicySettlement(uint256 policyId) external returns (bytes32)",
  "function pendingRequestId() external view returns (bytes32)",
  "function pendingPolicyId() external view returns (uint256)",
  "function getPolicySettlementState(uint256 policyId) external view returns (bytes32 pendingRequestId, bytes32 lastRequestId, bytes lastResponse, bytes lastError)",
  "function owner() external view returns (address)"
];

export const ABI = [
  // ── State-changing functions ────────────────────────────────────
  // createPolicy is now payable (msg.value = maxPremium escrowed by passenger)
  "function createPolicy(bytes32 flightRef, uint256 departureTime, uint256 delayThreshold, uint256 fixedPayout, uint256 auctionEnd, uint256 expiry) external payable returns (uint256)",
  "function bidPremium(uint256 policyId, uint256 premiumAmount) external",
  // finalizeAuction is payable (msg.value = fixedPayout collateral from underwriter)
  "function finalizeAuction(uint256 policyId) external payable",
  "function expireUnbidPolicy(uint256 policyId) external",
  "function resolvePolicy(uint256 policyId, uint256 delayMins) external",
  "function transferFrom(address from, address to, uint256 tokenId) external",
  "function safeTransferFrom(address from, address to, uint256 tokenId) external",

  // ── View functions ──────────────────────────────────────────────
  // Policy struct now includes maxPremium field
  "function getPolicy(uint256 policyId) external view returns (tuple(bytes32 flightRef, uint256 departureTime, uint256 delayThreshold, uint256 fixedPayout, uint256 maxPremium, uint256 auctionEnd, uint256 expiry, uint256 bestPremium, address bestUnderwriter, address passenger, uint8 status, uint256 policyNFTId, uint256 riskNFTId))",
  "function policyCount() external view returns (uint256)",
  "function resolver() external view returns (address)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function isRiskNFT(uint256 tokenId) external view returns (bool)",
  "function nftToPolicyId(uint256 tokenId) external view returns (uint256)",
  "function getNFTType(uint256 tokenId) external view returns (string)",

  // ── Events ──────────────────────────────────────────────────────
  "event PolicyCreated(uint256 indexed policyId, address indexed passenger, bytes32 flightRef, uint256 fixedPayout, uint256 maxPremium, uint256 auctionEnd)",
  "event BidPlaced(uint256 indexed policyId, address indexed underwriter, uint256 premium)",
  "event AuctionFinalized(uint256 indexed policyId, address indexed underwriter, uint256 premiumPaid, uint256 refundToPassenger, uint256 policyNFTId, uint256 riskNFTId)",
  "event PolicyResolved(uint256 indexed policyId, uint8 result, address recipient, uint256 amount)"
];

export const STATUS = { 0: "BIDDING", 1: "ACTIVE", 2: "PAID", 3: "EXPIRED" };
