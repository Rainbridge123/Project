// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISkyHedgeCoreChainlink {
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
        uint8    status;
        uint256  policyNFTId;
        uint256  riskNFTId;
    }

    function policyCount() external view returns (uint256);
    function getPolicy(uint256 policyId) external view returns (Policy memory);
    function resolvePolicyFromOracle(uint256 policyId, uint256 delayMins) external;
}
