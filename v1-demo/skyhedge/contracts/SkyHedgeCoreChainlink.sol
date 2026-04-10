// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SkyHedgeCoreChainlink
 * @notice Sepolia deployment variant that only allows settlement through a Chainlink oracle coordinator.
 */
contract SkyHedgeCoreChainlink is ERC721, ReentrancyGuard {
    enum Status { BIDDING, ACTIVE, PAID, EXPIRED }

    struct Policy {
        bytes32  flightRef;
        uint256  departureTime;
        uint256  delayThreshold;
        uint256  fixedPayout;
        uint256  maxPremium;
        uint256  auctionEnd;
        uint256  expiry;
        uint256  bestPremium;
        address  bestUnderwriter;
        address  passenger;
        Status   status;
        uint256  policyNFTId;
        uint256  riskNFTId;
    }

    address public owner;
    address public oracleCoordinator;
    uint256 public policyCount;
    uint256 public tokenCount;

    mapping(uint256 => Policy)  public policies;
    mapping(uint256 => bool)    public isRiskNFT;
    mapping(uint256 => uint256) public nftToPolicyId;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OracleCoordinatorUpdated(address indexed previousCoordinator, address indexed newCoordinator);
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
        uint256 premiumPaid,
        uint256 refundToPassenger,
        uint256 policyNFTId,
        uint256 riskNFTId
    );
    event PolicyResolved(
        uint256 indexed policyId,
        Status   result,
        address  recipient,
        uint256  amount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor(address initialOwner) ERC721("SkyHedge", "SKH") {
        require(initialOwner != address(0), "Invalid owner");
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setOracleCoordinator(address newCoordinator) external onlyOwner {
        require(newCoordinator != address(0), "Invalid coordinator");
        emit OracleCoordinatorUpdated(oracleCoordinator, newCoordinator);
        oracleCoordinator = newCoordinator;
    }

    // Compatibility helper so the existing frontend can still read the settlement authority.
    function resolver() external view returns (address) {
        return oracleCoordinator;
    }

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

        uint256 maxPremium = msg.value;

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
            bestPremium:     maxPremium,
            bestUnderwriter: address(0),
            passenger:       msg.sender,
            status:          Status.BIDDING,
            policyNFTId:     0,
            riskNFTId:       0
        });

        emit PolicyCreated(policyId, msg.sender, flightRef, fixedPayout, maxPremium, auctionEnd);
    }

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

        policy.status = Status.ACTIVE;

        tokenCount++;
        uint256 pNFTId = tokenCount;

        tokenCount++;
        uint256 rNFTId = tokenCount;

        policy.policyNFTId = pNFTId;
        policy.riskNFTId   = rNFTId;

        nftToPolicyId[pNFTId] = policyId;
        nftToPolicyId[rNFTId] = policyId;
        isRiskNFT[rNFTId]     = true;

        _mint(policy.passenger, pNFTId);
        _mint(msg.sender,       rNFTId);

        (bool ok1, ) = msg.sender.call{value: premiumEarned}("");
        require(ok1, "Premium transfer to underwriter failed");

        if (refund > 0) {
            (bool ok2, ) = policy.passenger.call{value: refund}("");
            require(ok2, "Refund to passenger failed");
        }

        emit AuctionFinalized(policyId, msg.sender, premiumEarned, refund, pNFTId, rNFTId);
    }

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

    // Disabled on Chainlink-backed deployments. The coordinator must call resolvePolicyFromOracle instead.
    function resolvePolicy(uint256, uint256) external pure {
        revert("Direct resolver settlement disabled");
    }

    function resolvePolicyFromOracle(uint256 policyId, uint256 delayMins) external nonReentrant {
        require(msg.sender == oracleCoordinator, "Only coordinator can call this");

        Policy storage policy = policies[policyId];
        require(policy.status == Status.ACTIVE, "Policy not in ACTIVE phase");
        require(block.timestamp >= policy.departureTime + (policy.delayThreshold * 1 minutes), "Settlement window not reached");

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

    function getPolicy(uint256 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function getNFTType(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return isRiskNFT[tokenId] ? "RISK" : "POLICY";
    }
}
