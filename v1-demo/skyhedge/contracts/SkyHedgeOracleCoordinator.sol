// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AutomationCompatible} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {ISkyHedgeCoreChainlink} from "./interfaces/ISkyHedgeCoreChainlink.sol";

/**
 * @notice Sepolia-only coordinator that combines Chainlink Automation and Functions.
 *         Automation picks due ACTIVE policies, Functions queries Cirium, and
 *         fulfillRequest settles the policy through the Chainlink-only core contract.
 */
contract SkyHedgeOracleCoordinator is FunctionsClient, AutomationCompatible, ConfirmedOwner {
    using FunctionsRequest for FunctionsRequest.Request;

    uint8 private constant STATUS_ACTIVE = 1;

    struct PolicySettlementState {
        bytes32 pendingRequestId;
        bytes32 lastRequestId;
        bytes lastResponse;
        bytes lastError;
    }

    ISkyHedgeCoreChainlink public immutable skyHedgeCore;
    uint64 public subscriptionId;
    uint32 public callbackGasLimit;
    bytes32 public donId;
    string public sourceCode;
    uint8 public donHostedSecretsSlotId;
    uint64 public donHostedSecretsVersion;

    bytes32 public pendingRequestId;
    uint256 public pendingPolicyId;
    bytes public lastResponse;
    bytes public lastError;

    mapping(bytes32 => uint256) public requestToPolicyId;
    mapping(uint256 => PolicySettlementState) private policySettlementStates;

    event CoordinatorConfigUpdated();
    event SettlementRequestQueued(bytes32 indexed requestId, uint256 indexed policyId, string flightRef);
    event SettlementRequestFailed(bytes32 indexed requestId, uint256 indexed policyId, bytes err);
    event SettlementResolveFailed(bytes32 indexed requestId, uint256 indexed policyId, bytes revertData);
    event PolicyAutoResolved(bytes32 indexed requestId, uint256 indexed policyId, uint256 delayMins);

    error UnexpectedRequestID(bytes32 requestId);

    constructor(
        address coreAddress,
        address router,
        bytes32 initialDonId,
        uint64 initialSubscriptionId,
        uint32 initialCallbackGasLimit,
        string memory initialSourceCode
    ) FunctionsClient(router) ConfirmedOwner(msg.sender) {
        require(coreAddress != address(0), "Invalid core");
        skyHedgeCore = ISkyHedgeCoreChainlink(coreAddress);
        donId = initialDonId;
        subscriptionId = initialSubscriptionId;
        callbackGasLimit = initialCallbackGasLimit;
        sourceCode = initialSourceCode;
    }

    function setFunctionsConfig(uint64 newSubscriptionId, uint32 newCallbackGasLimit, bytes32 newDonId) external onlyOwner {
        subscriptionId = newSubscriptionId;
        callbackGasLimit = newCallbackGasLimit;
        donId = newDonId;
        emit CoordinatorConfigUpdated();
    }

    function setSourceCode(string calldata newSourceCode) external onlyOwner {
        sourceCode = newSourceCode;
        emit CoordinatorConfigUpdated();
    }

    function setDONHostedSecrets(uint8 newSlotId, uint64 newVersion) external onlyOwner {
        donHostedSecretsSlotId = newSlotId;
        donHostedSecretsVersion = newVersion;
        emit CoordinatorConfigUpdated();
    }

    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        if (pendingRequestId != bytes32(0)) {
            return (false, bytes(""));
        }

        uint256 totalPolicies = skyHedgeCore.policyCount();
        for (uint256 policyId = 1; policyId <= totalPolicies; policyId++) {
            if (_isEligiblePolicy(policyId)) {
                return (true, abi.encode(policyId));
            }
        }

        return (false, bytes(""));
    }

    function performUpkeep(bytes calldata performData) external override {
        require(pendingRequestId == bytes32(0), "Request already pending");

        uint256 policyId = abi.decode(performData, (uint256));
        require(_isEligiblePolicy(policyId), "Policy not eligible");

        _requestSettlement(policyId);
    }

    function requestPolicySettlement(uint256 policyId) external returns (bytes32 requestId) {
        require(pendingRequestId == bytes32(0), "Request already pending");
        require(_canRequestSettlement(policyId, msg.sender), "Not authorized to request settlement");
        require(_isEligiblePolicy(policyId), "Policy not eligible");
        return _requestSettlement(policyId);
    }

    function getPolicySettlementState(uint256 policyId)
        external
        view
        returns (
            bytes32 policyPendingRequestId,
            bytes32 policyLastRequestId,
            bytes memory policyLastResponse,
            bytes memory policyLastError
        )
    {
        PolicySettlementState storage state = policySettlementStates[policyId];
        return (state.pendingRequestId, state.lastRequestId, state.lastResponse, state.lastError);
    }

    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
        uint256 policyId = requestToPolicyId[requestId];
        if (policyId == 0) {
            revert UnexpectedRequestID(requestId);
        }

        PolicySettlementState storage state = policySettlementStates[policyId];

        lastResponse = response;
        lastError = err;
        state.pendingRequestId = bytes32(0);
        state.lastRequestId = requestId;
        state.lastResponse = response;
        state.lastError = err;
        delete requestToPolicyId[requestId];
        pendingRequestId = bytes32(0);
        pendingPolicyId = 0;

        if (err.length > 0) {
            emit SettlementRequestFailed(requestId, policyId, err);
            return;
        }

        uint256 delayMins = abi.decode(response, (uint256));

        try skyHedgeCore.resolvePolicyFromOracle(policyId, delayMins) {
            emit PolicyAutoResolved(requestId, policyId, delayMins);
        } catch (bytes memory revertData) {
            emit SettlementResolveFailed(requestId, policyId, revertData);
        }
    }

    function _requestSettlement(uint256 policyId) internal returns (bytes32 requestId) {
        require(bytes(sourceCode).length > 0, "Missing source code");
        require(subscriptionId > 0, "Missing subscription");
        require(callbackGasLimit > 0, "Missing callback gas");
        require(donId != bytes32(0), "Missing DON id");

        ISkyHedgeCoreChainlink.Policy memory policy = skyHedgeCore.getPolicy(policyId);
        string memory flightRef = _bytes32ToString(policy.flightRef);
        require(bytes(flightRef).length > 0, "Missing flightRef");

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(sourceCode);
        if (donHostedSecretsVersion > 0) {
            req.addDONHostedSecrets(donHostedSecretsSlotId, donHostedSecretsVersion);
        }

        string[] memory args = new string[](2);
        args[0] = flightRef;
        args[1] = Strings.toString(policy.departureTime);
        req.setArgs(args);

        requestId = _sendRequest(req.encodeCBOR(), subscriptionId, callbackGasLimit, donId);
        pendingRequestId = requestId;
        pendingPolicyId = policyId;
        requestToPolicyId[requestId] = policyId;
        policySettlementStates[policyId].pendingRequestId = requestId;

        emit SettlementRequestQueued(requestId, policyId, flightRef);
    }

    function _isEligiblePolicy(uint256 policyId) internal view returns (bool) {
        ISkyHedgeCoreChainlink.Policy memory policy = skyHedgeCore.getPolicy(policyId);
        if (policy.passenger == address(0)) return false;
        if (policy.status != STATUS_ACTIVE) return false;
        return block.timestamp >= policy.departureTime + (policy.delayThreshold * 1 minutes);
    }

    function _canRequestSettlement(uint256 policyId, address caller) internal view returns (bool) {
        if (caller == owner()) return true;

        ISkyHedgeCoreChainlink.Policy memory policy = skyHedgeCore.getPolicy(policyId);
        if (policy.passenger == address(0)) return false;

        return caller == policy.passenger || caller == policy.bestUnderwriter;
    }

    function _bytes32ToString(bytes32 value) internal pure returns (string memory) {
        uint256 length = 0;
        while (length < 32 && value[length] != 0) {
            length++;
        }

        bytes memory output = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            output[i] = value[i];
        }
        return string(output);
    }
}
