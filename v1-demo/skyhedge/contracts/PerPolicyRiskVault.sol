// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {ISkyHedgeCoreChainlink} from "./interfaces/ISkyHedgeCoreChainlink.sol";

/**
 * @title PerPolicyRiskVault
 * @notice Minimal vault that tokenizes the economic exposure of exactly one Risk NFT.
 *         The winning underwriter deploys the vault, transfers the Risk NFT into it,
 *         sells portions of the risk side, and share holders can later claim any
 *         returned collateral pro rata once the policy is resolved.
 */
contract PerPolicyRiskVault is ReentrancyGuard, IERC721Receiver {
    uint8 private constant STATUS_ACTIVE = 1;
    uint8 private constant STATUS_PAID = 2;
    uint8 private constant STATUS_EXPIRED = 3;
    uint256 private constant TOTAL_SHARES = 100;

    ISkyHedgeCoreChainlink public immutable skyHedgeCore;
    IERC721 public immutable riskNftCollection;
    uint256 public immutable policyId;
    uint256 public immutable riskNftId;
    address public immutable leadUnderwriter;
    address public immutable syndicateManager;

    uint256 public sharesForSale;
    uint256 public pricePerShare;
    uint256 public totalReward;
    uint256 public claimedShares;
    bool public riskNftDeposited;
    bool public isResolved;
    bool public riskNftReleased;

    mapping(address => uint256) public shareBalances;

    event RiskNftDeposited(address indexed from, uint256 indexed tokenId);
    event SharesPurchased(address indexed buyer, uint256 amount, uint256 totalPrice);
    event ResolutionCaptured(uint8 indexed policyStatus, uint256 totalReward);
    event RewardClaimed(address indexed account, uint256 sharesClaimed, uint256 payout);
    event RiskNftReleased(address indexed to, uint256 indexed tokenId);

    constructor(
        address coreAddress,
        uint256 policyId_,
        address leadUnderwriter_,
        address syndicateManager_,
        uint256 initialSharesForSale,
        uint256 initialPricePerShare
    ) {
        require(coreAddress != address(0), "Invalid core");
        require(leadUnderwriter_ != address(0), "Invalid lead");

        skyHedgeCore = ISkyHedgeCoreChainlink(coreAddress);
        riskNftCollection = IERC721(coreAddress);
        policyId = policyId_;

        ISkyHedgeCoreChainlink.Policy memory policy = skyHedgeCore.getPolicy(policyId_);
        require(policy.passenger != address(0), "Policy does not exist");
        require(policy.status == STATUS_ACTIVE, "Policy must be ACTIVE");
        require(policy.riskNFTId > 0, "Risk NFT not minted");
        require(policy.bestUnderwriter == leadUnderwriter_, "Lead is not winning underwriter");
        require(initialSharesForSale > 0 && initialSharesForSale <= TOTAL_SHARES, "Invalid initial shares");
        require(initialPricePerShare > 0, "Invalid initial price");
        require(_isListingValueValid(policy.fixedPayout, initialSharesForSale, initialPricePerShare), "Listing exceeds collateral exposure");

        leadUnderwriter = leadUnderwriter_;
        syndicateManager = syndicateManager_;
        riskNftId = policy.riskNFTId;
        shareBalances[leadUnderwriter_] = TOTAL_SHARES;
        sharesForSale = initialSharesForSale;
        pricePerShare = initialPricePerShare;
    }

    receive() external payable {
        require(msg.sender == address(skyHedgeCore), "Only core can send ETH");
    }

    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata
    ) external override returns (bytes4) {
        require(msg.sender == address(riskNftCollection), "Unexpected NFT collection");
        require(!riskNftDeposited, "Risk NFT already deposited");
        require(
            from == leadUnderwriter || (syndicateManager != address(0) && from == syndicateManager),
            "Unauthorized NFT sender"
        );
        require(tokenId == riskNftId, "Wrong Risk NFT");

        ISkyHedgeCoreChainlink.Policy memory policy = skyHedgeCore.getPolicy(policyId);
        require(policy.status == STATUS_ACTIVE, "Policy no longer ACTIVE");
        require(policy.riskNFTId == tokenId, "Risk NFT mismatch");
        require(policy.bestUnderwriter == leadUnderwriter, "Lead underwriter changed");

        riskNftDeposited = true;
        emit RiskNftDeposited(from, tokenId);
        return IERC721Receiver.onERC721Received.selector;
    }

    function buyShares(uint256 amountToBuy) external payable nonReentrant {
        require(riskNftDeposited, "Deposit Risk NFT first");
        require(!isResolved, "Policy already resolved");
        require(amountToBuy > 0, "Amount must be > 0");
        require(pricePerShare > 0, "Listing not configured");
        require(amountToBuy <= sharesForSale, "Not enough shares for sale");

        uint256 totalPrice = amountToBuy * pricePerShare;
        require(msg.value == totalPrice, "Incorrect ETH sent");

        sharesForSale -= amountToBuy;
        shareBalances[leadUnderwriter] -= amountToBuy;
        shareBalances[msg.sender] += amountToBuy;

        (bool ok, ) = leadUnderwriter.call{value: msg.value}("");
        require(ok, "Transfer to lead failed");

        emit SharesPurchased(msg.sender, amountToBuy, totalPrice);
    }

    function captureResolution() external {
        require(!isResolved, "Resolution already captured");

        ISkyHedgeCoreChainlink.Policy memory policy = skyHedgeCore.getPolicy(policyId);
        require(policy.status == STATUS_PAID || policy.status == STATUS_EXPIRED, "Policy not resolved yet");

        isResolved = true;
        sharesForSale = 0;
        totalReward = policy.status == STATUS_EXPIRED ? address(this).balance : 0;

        emit ResolutionCaptured(policy.status, totalReward);
    }

    function claimReward() external nonReentrant {
        require(isResolved, "Capture resolution first");
        require(totalReward > 0, "No reward available");

        uint256 userShares = shareBalances[msg.sender];
        require(userShares > 0, "No shares to claim");

        uint256 payout = claimedShares + userShares == TOTAL_SHARES
            ? address(this).balance
            : (totalReward * userShares) / TOTAL_SHARES;

        shareBalances[msg.sender] = 0;
        claimedShares += userShares;

        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "Payout failed");

        emit RewardClaimed(msg.sender, userShares, payout);
    }

    function releaseRiskNft(address to) external nonReentrant {
        require(msg.sender == leadUnderwriter, "Only lead underwriter");
        require(isResolved, "Policy not resolved");
        require(!riskNftReleased, "Risk NFT already released");
        require(to != address(0), "Invalid recipient");

        riskNftReleased = true;
        riskNftCollection.safeTransferFrom(address(this), to, riskNftId);

        emit RiskNftReleased(to, riskNftId);
    }

    function _isListingValueValid(
        uint256 fixedPayout,
        uint256 sharesToSell,
        uint256 sharePrice
    ) internal pure returns (bool) {
        return sharePrice * sharesToSell <= (fixedPayout * sharesToSell) / TOTAL_SHARES;
    }
}
