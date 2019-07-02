pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./IEnforcer.sol";
import "./Merkelizer.slb";


contract Enforcer is IEnforcer {
    /// @param _taskPeriod should be min. two times the `_challengePeriod`
    constructor(
        address _verifier,
        uint256 _taskPeriod,
        uint256 _challengePeriod,
        uint256 _bondAmount,
        uint256 _maxExecutionDepth
    ) public {
        verifier = Verifier(_verifier);
        taskPeriod = _taskPeriod;
        challengePeriod = _challengePeriod;
        bondAmount = _bondAmount;
        maxExecutionDepth = _maxExecutionDepth;
    }

    function request(EVMParameters memory _parameters, bytes memory callData) public returns (bytes32) {
        if (_parameters.dataHash == bytes32(0) && callData.length > 0) {
            _parameters.dataHash = Merkelizer.dataHash(callData);
        }

        bytes32 taskHash = parameterHash(_parameters);
        Task storage task = tasks[taskHash];

        require(task.startBlock == 0, "Parameters already registered");

        task.startBlock = block.number;

        emit Requested(
            taskHash,
            _parameters,
            callData
        );

        return taskHash;
    }

    function register(
        bytes32 _taskHash,
        bytes32 _solverPathRoot,
        bytes32[] memory _resultProof,
        bytes memory _result
    ) public payable
    {
        uint256 executionDepth = _resultProof.length;
        bytes32 executionId = keccak256(abi.encodePacked(_taskHash, _solverPathRoot));

        ExecutionResult storage executionResult = executions[executionId];
        Task storage task = tasks[_taskHash];

        require(task.startBlock != 0, "Execution request does not exist");
        //require(task.startBlock + taskPeriod > block.number, "Task period is over");
        require((block.number + (challengePeriod * 2)) < (task.startBlock + taskPeriod), "Too late for registration");
        require(executionResult.startBlock == 0, "Execution already registered");
        require(msg.value == bondAmount, "Bond is required");
        require(executionDepth <= maxExecutionDepth, "Execution too long");

        executionResult.startBlock = block.number;
        executionResult.taskHash = _taskHash;
        executionResult.executionDepth = executionDepth;
        executionResult.solverPathRoot = _solverPathRoot;
        executionResult.resultHash = keccak256(abi.encodePacked(_result));
        executionResult.solver = msg.sender;

        task.executions.push(executionId);

        bonds[msg.sender] += msg.value;

        emit Registered(
            _taskHash,
            _solverPathRoot,
            executionDepth,
            _result
        );
    }

    function dispute(bytes32 _solverPathRoot, bytes32 _challengerPathRoot, EVMParameters memory _parameters)
        public payable
    {
        bytes32 taskHash = parameterHash(_parameters);
        bytes32 executionId = keccak256(abi.encodePacked(taskHash, _solverPathRoot));
        ExecutionResult memory executionResult = executions[executionId];

        require(msg.value == bondAmount, "Bond amount is required");
        require(executionResult.startBlock != 0, "Execution does not exist");
        // executionDepth round plus 1 for submitProof
        require(
            executionResult.startBlock + challengePeriod > block.number + (executionResult.executionDepth + 1) * verifier.timeoutDuration(),
            "Execution is out of challenge period"
        );

        bonds[msg.sender] += bondAmount;

        // TODO: Verifier needs to support all EVMParameters
        bytes32 disputeId = verifier.initGame(
            executionId,
            _solverPathRoot,
            _challengerPathRoot,
            executionResult.executionDepth,
            _parameters.customEnvironmentHash,
            _parameters.codeHash,
            _parameters.dataHash,
            // challenger
            msg.sender
        );

        emit DisputeInitialised(disputeId, executionId);
    }

    /// only callable from verifier
    function result(bytes32 _executionId, bool solverWon, address challenger) public {
        ExecutionResult memory execution = executions[_executionId];

        require(msg.sender == address(verifier));
        require(execution.startBlock != 0, "Execution does not exist");
        require(execution.startBlock + challengePeriod > block.number, "Execution is out of challenge period");

        if (solverWon) {
            // slash deposit of challenger
            bonds[challenger] -= bondAmount;

            address(bytes20(execution.solver)).transfer(bondAmount);
            emit Slashed(_executionId, challenger);
        } else {
            // clear the slot in the `Task.executions` array
            bytes32[] storage taskExecutions = tasks[executions[_executionId].taskHash].executions;

            for (uint i = 0; i < taskExecutions.length; i++) {
                if (taskExecutions[i] == _executionId) {
                    taskExecutions[i] = bytes32(0);
                    break;
                }
            }

            delete executions[_executionId];

            // slash deposit of solver
            bonds[execution.solver] -= bondAmount;
            address(bytes20(challenger)).transfer(bondAmount);

            emit Slashed(_executionId, execution.solver);
        }
    }

    function getStatus(bytes32 _taskHash) public view returns (uint256, bytes32[] memory, bytes32[] memory) {
        Task storage task = tasks[_taskHash];

        require(task.startBlock != 0, "Task does not exist");

        bytes32[] storage taskExecutions = task.executions;
        uint256 len = taskExecutions.length;
        bytes32[] memory pathRoots = new bytes32[](len);
        bytes32[] memory resultHashes = new bytes32[](len);

        uint256 realIndex = 0;
        for (uint256 i = 0; i < len; i++) {
            bytes32 execId = taskExecutions[i];

            if (execId == bytes32(0)) {
                continue;
            }

            ExecutionResult storage execResult = executions[execId];

            pathRoots[realIndex] = execResult.solverPathRoot;
            resultHashes[realIndex] = execResult.resultHash;
            realIndex++;
        }

        assembly {
            mstore(pathRoots, realIndex)
            mstore(resultHashes, realIndex)
        }

        return (task.startBlock + taskPeriod, pathRoots, resultHashes);
    }
}
