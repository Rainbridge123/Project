// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SkyHedgeCore
 * @notice Decentralised parametric flight-delay insurance.
 *
 * Reverse Auction flow:
 *   1. Passenger calls createPolicy(), paying maxPremium into escrow.
 *   2. Underwriters call bidPremium() competing for the LOWEST premium (≤ maxPremium).
 *   3. After auctionEnd, the winning underwriter calls finalizeAuction():
 *        - Locks fixedPayout as collateral (msg.value == fixedPayout)
 *        - Transfers bestPremium to themselves (earned premium)
 *        - Refunds (maxPremium - bestPremium) to the passenger
 *        - Mints Policy NFT → passenger, Risk NFT → underwriter
 *   4. Resolver calls resolvePolicy():
 *        - Delayed  → fixedPayout to current Policy NFT holder
 *        - On time  → fixedPayout returned to current Risk NFT holder
 *
 * NFT Bearer Instruments:
 *   Policy NFT → right to receive payout if flight is delayed
 *   Risk NFT   → right to receive collateral back if flight is on time
 *
 * Status machine:
 *   BIDDING → (finalizeAuction before expiry) → ACTIVE → (resolvePolicy) → PAID | EXPIRED
 *           ↘ (expireUnbidPolicy after expiry) → EXPIRED
 */
contract SkyHedgeCore is ERC721, ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────
    //  Types
    // ─────────────────────────────────────────────────────────────

    enum Status { BIDDING, ACTIVE, PAID, EXPIRED }

    struct Policy {
        bytes32  flightRef;         // flight identifier
        uint256  departureTime;     // Unix timestamp
        uint256  delayThreshold;    // minutes; payout triggers at or above this
        uint256  fixedPayout;       // wei; locked as collateral by underwriter
        uint256  maxPremium;        // wei; max premium passenger is willing to pay (escrowed)
        uint256  auctionEnd;        // Unix timestamp; bidding closes at this time
        uint256  expiry;            // Unix timestamp; policy expires if unresolved
        uint256  bestPremium;       // wei; lowest bid so far (starts at maxPremium)
        address  bestUnderwriter;   // address that placed the best bid
        address  passenger;         // original policy creator
        Status   status;
        uint256  policyNFTId;       // tokenId of the Policy NFT
        uint256  riskNFTId;         // tokenId of the Risk NFT
    }

    // ─────────────────────────────────────────────────────────────
    //  Storage
    // ─────────────────────────────────────────────────────────────

    address public resolver;
    uint256 public policyCount;
    uint256 public tokenCount;

    mapping(uint256 => Policy)  public policies;
    mapping(uint256 => bool)    public isRiskNFT;
    mapping(uint256 => uint256) public nftToPolicyId;

    // ─────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed passenger,
        bytes32 flightRef,
        uint256 fixedPayout,
        uint256 maxPremium,
        uint256 auctionEnd
    );
    event BidPlaced(
        uint256 indexed policyId,
        address indexed underwriter,
        uint256 premium
    );
    event AuctionFinalized(
        uint256 indexed policyId,
        address indexed underwriter,
        uint256 premiumPaid,        // bestPremium transferred to underwriter
        uint256 refundToPassenger,  // maxPremium - bestPremium returned to passenger
        uint256 policyNFTId,
        uint256 riskNFTId
    );
    event PolicyResolved(
        uint256 indexed policyId,
        Status   result,
        address  recipient,
        uint256  amount
    );

    // ─────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────

    constructor(address _resolver) ERC721("SkyHedge", "SKH") {
        require(_resolver != address(0), "Invalid resolver");
        resolver = _resolver;
    }

    // ─────────────────────────────────────────────────────────────
    //  Core Functions
    // ─────────────────────────────────────────────────────────────

    /**
     * @notice Passenger creates a policy and escrows maxPremium.
     * @dev    msg.value must equal maxPremium.
     * @param flightRef       Flight identifier.
     * @param departureTime   Expected departure (Unix timestamp).
     * @param delayThreshold  Delay in minutes that triggers payout.
     * @param fixedPayout     Payout amount in wei.
     * @param auctionEnd      When the auction closes (Unix timestamp).
     * @param expiry          When the policy expires (Unix timestamp).
     * @return policyId       The ID of the new policy.
     */
    function createPolicy(
        bytes32 flightRef,
        uint256 departureTime,
        uint256 delayThreshold,
        uint256 fixedPayout,
        uint256 auctionEnd,
        uint256 expiry
    ) external payable returns (uint256 policyId) {
        require(auctionEnd > block.timestamp,    "auctionEnd must be in the future");
        require(expiry > auctionEnd,             "expiry must be after auctionEnd");
        require(fixedPayout > 0,                 "fixedPayout must be > 0");
        require(delayThreshold > 0,              "delayThreshold must be > 0");
        require(departureTime > block.timestamp, "departureTime must be in the future");
        require(msg.value > 0,                   "Must escrow maxPremium (msg.value > 0)");

        uint256 maxPremium = msg.value;          // passenger escrowed premium

        policyCount++;
        policyId = policyCount;

        policies[policyId] = Policy({
            flightRef:       flightRef,
            departureTime:   departureTime,
            delayThreshold:  delayThreshold,
            fixedPayout:     fixedPayout,
            maxPremium:      maxPremium,
            auctionEnd:      auctionEnd,
            expiry:          expiry,
            bestPremium:     maxPremium,         // auction starts at maxPremium ceiling
            bestUnderwriter: address(0),
            passenger:       msg.sender,
            status:          Status.BIDDING,
            policyNFTId:     0,
            riskNFTId:       0
        });

        emit PolicyCreated(policyId, msg.sender, flightRef, fixedPayout, maxPremium, auctionEnd);
    }

    /**
     * @notice Underwriter bids to cover the policy for premiumAmount wei.
     *         Must be strictly lower than the current best bid.
     *         Must be <= maxPremium (passenger's ceiling).
     */
    function bidPremium(uint256 policyId, uint256 premiumAmount) external {
        Policy storage policy = policies[policyId];
        require(policy.status == Status.BIDDING,      "Policy not in BIDDING phase");
        require(block.timestamp < policy.auctionEnd,  "Auction has ended");
        require(premiumAmount > 0,                    "Premium must be > 0");
        require(premiumAmount < policy.bestPremium,   "Must beat current best bid");
        require(premiumAmount <= policy.maxPremium,   "Premium exceeds passenger maxPremium");

        policy.bestPremium     = premiumAmount;
        policy.bestUnderwriter = msg.sender;

        emit BidPlaced(policyId, msg.sender, premiumAmount);
    }

    /**
     * @notice Winning underwriter finalises the auction.
     *         msg.value must equal fixedPayout (collateral).
     *
     *         On success (atomically):
     *           - bestPremium transferred to underwriter (earned fee)
     *           - (maxPremium - bestPremium) refunded to passenger
     *           - fixedPayout locked in contract as collateral
     *           - Policy NFT minted to passenger
     *           - Risk NFT minted to underwriter
     *           - Status → ACTIVE
     */
    function finalizeAuction(uint256 policyId) external payable nonReentrant {
        Policy storage policy = policies[policyId];
        require(policy.status == Status.BIDDING,           "Policy not in BIDDING phase");
        require(block.timestamp >= policy.auctionEnd,      "Auction has not ended yet");
        require(block.timestamp < policy.expiry,           "Policy has expired");
        require(policy.bestUnderwriter != address(0),      "No bids were placed");
        require(msg.sender == policy.bestUnderwriter,      "Only winning underwriter can finalize");
        require(msg.value == policy.fixedPayout,           "msg.value must equal fixedPayout");

        uint256 premiumEarned = policy.bestPremium;
        uint256 refund        = policy.maxPremium - premiumEarned;

        // ── Effects ──────────────────────────────────────────────
        policy.status = Status.ACTIVE;

        tokenCount++;
        uint256 pNFTId = tokenCount;   // Policy NFT

        tokenCount++;
        uint256 rNFTId = tokenCount;   // Risk NFT

        policy.policyNFTId = pNFTId;
        policy.riskNFTId   = rNFTId;

        nftToPolicyId[pNFTId] = policyId;
        nftToPolicyId[rNFTId] = policyId;
        isRiskNFT[rNFTId]     = true;

        // ── Interactions ─────────────────────────────────────────
        _mint(policy.passenger, pNFTId);   // Policy NFT → passenger
        _mint(msg.sender,       rNFTId);   // Risk NFT   → underwriter

        // Transfer earned premium to underwriter
        (bool ok1, ) = msg.sender.call{value: premiumEarned}("");
        require(ok1, "Premium transfer to underwriter failed");

        // Refund excess premium to passenger (if any)
        if (refund > 0) {
            (bool ok2, ) = policy.passenger.call{value: refund}("");
            require(ok2, "Refund to passenger failed");
        }

        emit AuctionFinalized(policyId, msg.sender, premiumEarned, refund, pNFTId, rNFTId);
    }

    /**
     * @notice Expires any still-unfinalized policy after its expiry time and refunds maxPremium to passenger.
     * @dev    Only the original passenger may reclaim escrow once the policy has passed expiry in BIDDING.
     */
    function expireUnbidPolicy(uint256 policyId) external nonReentrant {
        Policy storage policy = policies[policyId];
        require(policy.status == Status.BIDDING,      "Policy not in BIDDING phase");
        require(block.timestamp >= policy.expiry,     "Policy has not expired yet");
        require(msg.sender == policy.passenger,       "Only passenger can refund");

        uint256 refund = policy.maxPremium;
        address passenger = policy.passenger;

        policy.status = Status.EXPIRED;

        emit PolicyResolved(policyId, Status.EXPIRED, passenger, refund);

        (bool ok, ) = passenger.call{value: refund}("");
        require(ok, "Refund to passenger failed");
    }

    /**
     * @notice Trusted resolver submits delay data and triggers settlement.
     *         Delayed  → fixedPayout to current Policy NFT holder.
     *         On time  → fixedPayout returned to current Risk NFT holder.
     */
    function resolvePolicy(uint256 policyId, uint256 delayMins) external nonReentrant {
        require(msg.sender == resolver, "Only resolver can call this");

        Policy storage policy = policies[policyId];
        require(policy.status == Status.ACTIVE, "Policy not in ACTIVE phase");

        address policyNFTOwner = ownerOf(policy.policyNFTId);
        address riskNFTOwner   = ownerOf(policy.riskNFTId);
        uint256 amount         = policy.fixedPayout;

        if (delayMins >= policy.delayThreshold) {
            policy.status = Status.PAID;
            emit PolicyResolved(policyId, Status.PAID, policyNFTOwner, amount);
            (bool ok, ) = policyNFTOwner.call{value: amount}("");
            require(ok, "Payout transfer failed");
        } else {
            policy.status = Status.EXPIRED;
            emit PolicyResolved(policyId, Status.EXPIRED, riskNFTOwner, amount);
            (bool ok, ) = riskNFTOwner.call{value: amount}("");
            require(ok, "Collateral return failed");
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  View Helpers
    // ─────────────────────────────────────────────────────────────

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function getNFTType(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return isRiskNFT[tokenId] ? "RISK" : "POLICY";
    }
}
