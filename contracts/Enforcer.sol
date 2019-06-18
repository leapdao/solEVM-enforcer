pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./IEnforcer.sol";
import "./Verifier.sol";


contract Enforcer is IEnforcer {
    uint256 public requestPeriod;
    uint256 public challengePeriod;
    uint256 public maxExecutionDepth;
    uint256 public bondAmount;
    Verifier public verifier;

    mapping(address => uint256) public bonds;
    // For tracking the block number of the `request(...)`
    mapping(bytes32 => uint256) public executionRequests;
    mapping(bytes32 => ExecutionResult) public executionResults;

    /*
     * @dev Enforcer constructor
     *     _verifer: ... 
     */
    constructor(
        address _verifier,
        uint256 _requestPeriod,
        uint256 _challengePeriod,
        uint256 _bondAmount,
        uint256 _maxExecutionDepth
    ) public {
        verifier = Verifier(_verifier);
        requestPeriod = _requestPeriod;
        challengePeriod = _challengePeriod;
        bondAmount = _bondAmount;
        maxExecutionDepth = _maxExecutionDepth;
    }

    function request(EVMParameters memory _parameters) public returns (bytes32) {
        bytes32 executionId = parameterHash(_parameters);
        uint256 startBlock = executionRequests[executionId];

        require(startBlock == 0, "Parameters already registered");

        executionRequests[executionId] = block.number;
        emit Request(
            executionId,
            _parameters
        );

        return executionId;
    }

    /*
     */
    function register(
        bytes32 _executionId,
        bytes32 _endHash,
        uint256 _executionDepth,
        bytes32 _resultHash
    ) public payable
    {
        bytes32 executionResultId = keccak256(abi.encodePacked(_executionId, _resultHash));
        ExecutionResult memory executionResult = executionResults[executionResultId];
        uint256 startBlock = executionRequests[_executionId];

        require(startBlock != 0, "Execution request does not exist");
        require(startBlock + requestPeriod > block.number, "Registration period is over");
        require(executionResult.startBlock == 0, "Execution already registered");
        require(msg.value == bondAmount, "Bond is required");
        require(_executionDepth <= maxExecutionDepth, "Execution too long");

        // update the struct
        executionResult.startBlock = block.number;
        executionResult.endHash = _endHash;
        executionResult.executionDepth = _executionDepth;
        executionResult.resultHash = _resultHash;
        executionResult.solver = msg.sender;

        executionResults[executionResultId] = executionResult;
        bonds[msg.sender] += msg.value;

        emit Registered(
            _executionId,
            msg.sender,
            executionResultId,
            _endHash,
            _executionDepth,
            _resultHash
        );
    }

    /**
      * @dev dispute is called by challenger to start a new dispute
      *     assumed that challenger's execution tree is of the same depth as solver's
      *     in case challenger's tree is shallower, he should use node with zero hash to make it deeper
      *     in case challenger's tree is deeper, he should submit only the left subtree with the same depth with solver's
      */
    function dispute(bytes32 _executionResultId, bytes32 _endHash, EVMParameters memory _parameters)
        public payable
    {
        ExecutionResult memory executionResult = executionResults[_executionResultId];
        bytes32 executionId = parameterHash(_parameters);
        bytes32 executionResultId = keccak256(abi.encodePacked(executionId, executionResult.resultHash));

        require(msg.value == bondAmount, "Bond amount is required");
        require(executionResult.startBlock != 0, "Execution does not exist");
        require(_executionResultId == executionResultId, "_executionResultId is wrong");
        // executionDepth round plus 1 for submitProof
        require(
            executionResult.startBlock + challengePeriod > block.number + (executionResult.executionDepth + 1) * verifier.timeoutDuration(),
            "Execution is out of challenge period"
        );

        bonds[msg.sender] += bondAmount;

        // TODO: Verifier needs to support all EVMParameters
        bytes32 disputeId = verifier.initGame(
            _executionResultId,
            executionResult.endHash,
            _endHash,
            executionResult.executionDepth,
            _parameters.customEnvironmentHash,
            _parameters.codeHash,
            _parameters.dataHash,
            // challenger
            msg.sender
        );

        emit DisputeInitialised(disputeId, executionId);
    }

    /*
     * @dev receive result from Verifier contract
     *     only callable from verifier
     */
    function result(bytes32 _executionResultId, bool solverWon, address challenger) public {
        ExecutionResult memory execution = executionResults[_executionResultId];

        require(msg.sender == address(verifier));
        require(execution.startBlock != 0, "Execution does not exist");
        require(execution.startBlock + challengePeriod > block.number, "Execution is out of challenge period");

        if (solverWon) {
            // slash deposit of challenger
            bonds[challenger] -= bondAmount;

            address(bytes20(execution.solver)).transfer(bondAmount);
            emit Slashed(_executionResultId, challenger);
        } else {
            // slash deposit of solver
            bonds[execution.solver] -= bondAmount;

            address(bytes20(challenger)).transfer(bondAmount);
            emit Slashed(_executionResultId, execution.solver);
            // delete execution
            delete executionResults[_executionResultId];
        }
    }
}
