pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./IEnforcer.sol";
import "./Merkelizer.slb";


contract Enforcer is IEnforcer {
    /// @param _verifier is the verifier's contract address
    /// @param _taskPeriod The time (in seconds) how long the verification game for a given task
    /// is active, should be min. two times the `_challengePeriod`.
    /// @param _challengePeriod The time (in seconds) how long a execution can be challenged.
    /// @param _bondAmount The stake each solver or challenger has to bring.
    /// @param _maxExecutionDepth The maximum depth of the execution's merkle tree.
    /// Depending how deep it is,
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

        require(task.startTime == 0, "Parameters already registered");

        task.startTime = block.timestamp;

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
        require(verifyResultProof(_solverPathRoot, _resultProof, _result) == true, "invalid resultProof");

        uint256 executionDepth = _resultProof.length / 2;
        bytes32 executionId = keccak256(abi.encodePacked(_taskHash, _solverPathRoot));

        ExecutionResult storage executionResult = executions[executionId];
        Task storage task = tasks[_taskHash];

        require(task.startTime != 0, "Execution request does not exist");
        require((block.timestamp + (challengePeriod * 2)) < (task.startTime + taskPeriod), "Too late for registration");
        require(executionResult.startTime == 0, "Execution already registered");
        require(msg.value == bondAmount, "Bond is required");
        require(executionDepth <= maxExecutionDepth, "Execution too long");

        executionResult.startTime = block.timestamp;
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
        require(executionResult.startTime != 0, "Execution does not exist");
        // executionDepth round plus 1 for submitProof
        require(
            (executionResult.startTime + challengePeriod)
            > block.timestamp + (executionResult.executionDepth + 1) * verifier.timeoutDuration(),
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
        require(execution.startTime != 0, "Execution does not exist");
        require(execution.startTime + challengePeriod > block.timestamp, "Execution is out of challenge period");

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

        require(task.startTime != 0, "Task does not exist");

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

        return (task.startTime + taskPeriod, pathRoots, resultHashes);
    }

    /// @notice Verify `returnData` of the last execution step.
    /// @dev Attention: This function modifies the `_resultProof` array!
    /// @return bool `true` if correct, `false` otherwise
    function verifyResultProof(
        bytes32 _pathRoot,
        bytes32[] memory _resultProof,
        bytes memory _result
    ) public pure returns (bool) {
        if (_resultProof.length < 2 || (_resultProof.length % 2) != 0) {
            return false;
        }

        bool valid = true;
        assembly {
            // length in bytes of _resultProof
            let len := mload(_resultProof)
            // pointer to first value in _resultProof
            let ptr := add(_resultProof, 0x20)
            // pointer to _resultProof[_resultProof.length - 2]
            let leftPtr := add(ptr, mul(sub(len, 2), 0x20))
            // pointer to _resultProof[_resultProof.length - 1]
            let rightPtr := add(leftPtr, 0x20)
            // length in bytes of _result
            let resultBytesLen := mload(_result)
            // if `right` is zero, we use `left`
            let hashRightValue := mload(rightPtr)

            if iszero(hashRightValue) {
                // hash left
                mstore(_result, mload(leftPtr))
            }
            if gt(hashRightValue, 0) {
                // hash right
                mstore(_result, hashRightValue)
            }
            // the stateHash for the last leaf
            let stateHash := keccak256(_result, add(resultBytesLen, 0x20))
            // restore len from _result
            mstore(_result, resultBytesLen)

            // store the updated value into `_resultProof`
            if iszero(hashRightValue) {
                mstore(leftPtr, stateHash)
            }
            if gt(hashRightValue, 0) {
                mstore(rightPtr, stateHash)
            }

            let parentHash := _pathRoot
            for { let i := 0 } lt(i, len) { i := add(i, 2) } {
                let left := add(ptr, mul(i, 0x20))
                let rightVal := mload(add(left, 0x20))
                let nodeHash := keccak256(left, 0x40)

                if iszero(eq(nodeHash, parentHash)) {
                    // invalid
                    valid := 0
                    // end loop
                    len := 0
                }

                // we default to take the `right` path
                parentHash := rightVal
                // unless if it is zero, we go `left`
                if eq(rightVal, 0) {
                    parentHash := mload(left)
                }
            }
        }

        return valid;
    }
}
