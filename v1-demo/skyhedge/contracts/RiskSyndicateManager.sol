// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import {ISkyHedgeCoreChainlink} from "./interfaces/ISkyHedgeCoreChainlink.sol";
import {PerPolicyRiskVault} from "./PerPolicyRiskVault.sol";

/**
 * @title RiskSyndicateManager
 * @notice Single product entrypoint for creating risk syndicates.
 *         Winning underwriters transfer their Risk NFT here with launch parameters
 *         encoded in calldata. The manager deploys one dedicated vault per policy
 *         and forwards the NFT into that vault automatically.
 */
contract RiskSyndicateManager is IERC721Receiver {
    uint8 private constant STATUS_ACTIVE = 1;

    ISkyHedgeCoreChainlink public immutable skyHedgeCore;
    IERC721 public immutable riskNftCollection;

    mapping(uint256 => address) public vaultByPolicyId;
    mapping(address => uint256) public policyIdByVault;

    event SyndicateVaultCreated(
        uint256 indexed policyId,
        uint256 indexed riskNftId,
        address indexed leadUnderwriter,
        address vault,
        uint256 sharesForSale,
        uint256 pricePerShare
    );

    constructor(address coreAddress) {
        require(coreAddress != address(0), "Invalid core");
        skyHedgeCore = ISkyHedgeCoreChainlink(coreAddress);
        riskNftCollection = IERC721(coreAddress);
    }

    function onERC721Received(
        address,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        require(msg.sender == address(riskNftCollection), "Unexpected NFT collection");
        require(data.length > 0, "Missing launch data");

        uint256 policyId = skyHedgeCore.nftToPolicyId(tokenId);
        require(policyId > 0, "Unknown policy");
        require(vaultByPolicyId[policyId] == address(0), "Vault already exists");
        require(skyHedgeCore.isRiskNFT(tokenId), "Only Risk NFT accepted");

        ISkyHedgeCoreChainlink.Policy memory policy = skyHedgeCore.getPolicy(policyId);
        require(policy.passenger != address(0), "Policy does not exist");
        require(policy.status == STATUS_ACTIVE, "Policy must be ACTIVE");
        require(block.timestamp < policy.departureTime, "Vault launch window closed");
        require(policy.riskNFTId == tokenId, "Risk NFT mismatch");
        require(policy.bestUnderwriter == from, "Only winning underwriter can launch");

        (uint256 sharesForSale, uint256 pricePerShare) = abi.decode(data, (uint256, uint256));

        PerPolicyRiskVault vault = new PerPolicyRiskVault(
            address(skyHedgeCore),
            policyId,
            from,
            address(this),
            sharesForSale,
            pricePerShare
        );

        address vaultAddress = address(vault);
        vaultByPolicyId[policyId] = vaultAddress;
        policyIdByVault[vaultAddress] = policyId;

        riskNftCollection.safeTransferFrom(address(this), vaultAddress, tokenId);

        emit SyndicateVaultCreated(
            policyId,
            tokenId,
            from,
            vaultAddress,
            sharesForSale,
            pricePerShare
        );

        return IERC721Receiver.onERC721Received.selector;
    }
}
