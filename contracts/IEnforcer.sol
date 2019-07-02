pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./Verifier.sol";


contract IEnforcer {
    /// @notice Structure for the V-Game EVM environment.
    struct EVMParameters {
        // Transaction sender
        address origin;
        // address of the current contract / execution context
        address target;
        // blockHash
        bytes32 blockHash;
        // blockNumber
        uint256 blockNumber;
        // timestamp of the current block in seconds since the epoch
        uint256 time;
        // tx gas limit
        uint256 txGasLimit;
        // customEnvironmentHash - for custom implementations like Plasma Exit
        bytes32 customEnvironmentHash;
        // codeHash / dataHash should be the root hash of the given merkle tree
        // Except that codeHash could also be the contract address (addr + right-padded with zeros to 32 bytes)
        bytes32 codeHash;
        bytes32 dataHash;
    }

    struct Task {
        uint256 startBlock;
        bytes32[] executions;
    }

    struct ExecutionResult {
        uint256 startBlock;
        bytes32 taskHash;
        bytes32 solverPathRoot;
        bytes32 resultHash;
        uint256 executionDepth;
        address solver;
    }

    uint256 public taskPeriod;
    uint256 public challengePeriod;
    uint256 public maxExecutionDepth;
    uint256 public bondAmount;
    Verifier public verifier;

    mapping(address => uint256) public bonds;
    mapping(bytes32 => Task) public tasks;
    mapping(bytes32 => ExecutionResult) public executions;

    event Requested(bytes32 taskHash, EVMParameters parameters, bytes callData);

    event Registered(
        bytes32 indexed taskHash,
        bytes32 indexed solverPathRoot,
        uint256 executionDepth,
        bytes result
    );

    event DisputeInitialised(bytes32 indexed disputeId, bytes32 indexed executionId);
    event Slashed(bytes32 indexed executionId, address indexed _address);

    function parameterHash(EVMParameters memory _parameters) public pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                _parameters.target,
                _parameters.blockHash,
                _parameters.blockNumber,
                _parameters.time,
                _parameters.txGasLimit,
                _parameters.customEnvironmentHash,
                _parameters.codeHash,
                _parameters.dataHash
            )
        );
    }

    /// @notice request a new task
    /// @dev if `_parameters.dataHash` is zero and `callData.length` over zero
    /// then `_parameters.dataHash` will be recalculated
    /// @return bytes32 taskHash
    function request(EVMParameters memory _parameters, bytes memory callData) public returns (bytes32);

    /// @notice register
    function register(
        bytes32 _taskHash,
        bytes32 _solverPathRoot,
        bytes32[] memory _resultProof,
        bytes memory _result
    ) public payable;

    /// @notice dispute is called by challenger to start a new dispute
    /// assumed that challenger's execution tree is of the same depth as solver's.
    /// @dev In case challenger's tree is shallower, he should use node with zero hash to make it deeper.
    /// In case challenger's tree is deeper, he should submit only the left subtree with the same depth with solver's.
    function dispute(
        bytes32 _solverPathRoot,
        bytes32 _challengerPathRoot,
        EVMParameters memory _parameters
    ) public payable;

    /// @notice receive result from Verifier contract.
    /// only callable from `verifier`
    function result(bytes32 _executionId, bool solverWon, address challenger) public;

    /// @notice check execution results and `taskPeriod`
    /// @return endTime, pathRoots, resultHashes
    function getStatus(bytes32 _taskHash) public view returns (uint256, bytes32[] memory, bytes32[] memory);
}
