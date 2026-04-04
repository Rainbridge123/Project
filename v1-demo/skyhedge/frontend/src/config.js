// frontend/src/config.js
export const CONTRACT_ADDRESS = "0x492f741eFD472dEe814DC82A51247DB4C6d80dAf";
export const READ_RPC_URL = process.env.REACT_APP_SEPOLIA_RPC_URL || "";
export const DEPLOY_BLOCK = 10587628;

export const ABI = [
  // ── State-changing functions ────────────────────────────────────
  // createPolicy is now payable (msg.value = maxPremium escrowed by passenger)
  "function createPolicy(bytes32 flightRef, uint256 departureTime, uint256 delayThreshold, uint256 fixedPayout, uint256 auctionEnd, uint256 expiry) external payable returns (uint256)",
  "function bidPremium(uint256 policyId, uint256 premiumAmount) external",
  // finalizeAuction is payable (msg.value = fixedPayout collateral from underwriter)
  "function finalizeAuction(uint256 policyId) external payable",
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
