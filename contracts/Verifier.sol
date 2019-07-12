pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./Enforcer.sol";
import "./HydratedRuntime.sol";
import "./Merkelizer.slb";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract Verifier is Ownable, HydratedRuntime {
    using Merkelizer for Merkelizer.ExecutionState;

    struct Proofs {
        bytes32 stackHash;
        bytes32 memHash;
        bytes32 dataHash;
    }

    struct ComputationPath {
        bytes32 left;
        bytes32 right;
    }

    // 256x32 bytes as the memory limit
    uint constant internal MAX_MEM_WORD_COUNT = 256;

    uint8 constant internal SOLVER_RESPONDED = 1 << 0;
    uint8 constant internal CHALLENGER_RESPONDED = 1 << 1;
    uint8 constant internal SOLVER_VERIFIED = 1 << 2;
    uint8 constant internal CHALLENGER_VERIFIED = 1 << 3;
    uint8 constant internal START_OF_EXECUTION = 1 << 4;
    uint8 constant internal END_OF_EXECUTION = 1 << 5;
    uint8 constant internal INITIAL_STATE = START_OF_EXECUTION | END_OF_EXECUTION;

    struct Dispute {
        bytes32 executionId;
        bytes32 initialStateHash;
        bytes32 codeHash;
        address challengerAddr;

        bytes32 solverPath;
        bytes32 challengerPath;
        uint256 treeDepth;
        bytes32 witness;

        ComputationPath solver;
        ComputationPath challenger;

        uint8 state;

        uint256 timeout; // currently is block number
    }

    event DisputeNewRound(bytes32 indexed disputeId, uint256 timeout, bytes32 solverPath, bytes32 challengerPath);

    uint256 public timeoutDuration;

    Enforcer public enforcer;

    mapping (bytes32 => Dispute) public disputes;

    /**
      * @dev Throw if not called by enforcer
      */
    modifier onlyEnforcer() {
        require(msg.sender == address(enforcer), "only enforcer");
        _;
    }

    /**
      * @dev game not timeout yet
      */
    modifier onlyPlaying(bytes32 disputeId) {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.timeout >= block.number, "game timed out");
        require((dispute.state & SOLVER_VERIFIED == 0) && (dispute.state & CHALLENGER_VERIFIED == 0), "dispute resolved");
        _;
    }

    /// @param timeout The time the participants have to react to `submitRound, submitProof`.
    /// Should be at least 100 blocks.
    constructor(uint256 timeout) public Ownable() {
        timeoutDuration = timeout;
    }

    function setEnforcer(address _enforcer) public onlyOwner() {
        enforcer = Enforcer(_enforcer);
    }

    /**
      * @dev init a new dispute, only callable by enforcer
      */
    function initGame(
        bytes32 executionId,
        bytes32 solverHashRoot,
        bytes32 challengerHashRoot,
        uint256 executionDepth,
        // optional for implementors
        bytes32 customEnvironmentHash,
        // TODO: should be the bytes32 root hash later on
        bytes32 codeHash,
        bytes32 dataHash,
        address challenger
    ) public onlyEnforcer() returns (bytes32 disputeId) {
        bytes32 initialStateHash = Merkelizer.initialStateHash(dataHash, customEnvironmentHash);

        disputeId = keccak256(
            abi.encodePacked(
                executionId,
                initialStateHash,
                solverHashRoot,
                challengerHashRoot,
                executionDepth
            )
        );

        require(disputes[disputeId].timeout == 0, "already init");
        // do we want to prohibit early?
        // require(solverHashRoot != challengerHashRoot, "nothing to challenge");

        disputes[disputeId] = Dispute(
            executionId,
            initialStateHash,
            codeHash,
            challenger,
            solverHashRoot,
            challengerHashRoot,
            executionDepth,
            bytes32(0),
            ComputationPath(solverHashRoot, solverHashRoot),
            ComputationPath(challengerHashRoot, challengerHashRoot),
            INITIAL_STATE,
            getTimeout()
        );
    }

    /*
     * Solver or Challenger always respond with the next `ComputationPath`
     * for the path they do not agree on.
     * If they do not agree on both `left` and `right` they must follow/default
     * to `left`.
     */
    function respond(
        bytes32 disputeId,
        ComputationPath memory computationPath,
        ComputationPath memory witnessPath
    ) public onlyPlaying(disputeId) {
        Dispute storage dispute = disputes[disputeId];

        require(dispute.treeDepth > 0, "already reach leaf");

        bytes32 h = keccak256(abi.encodePacked(computationPath.left, computationPath.right));

        require(
            h == dispute.solverPath || h == dispute.challengerPath,
            "wrong path submitted"
        );

        if (h == dispute.solverPath) {
            dispute.state |= SOLVER_RESPONDED;
            dispute.solver = computationPath;
        }

        if (h == dispute.challengerPath) {
            dispute.state |= CHALLENGER_RESPONDED;
            dispute.challenger = computationPath;
        }

        updateRound(disputeId, dispute, witnessPath);
    }

    /*
     * if they agree on `left` but not on `right`,
     * submitProof (on-chain) verification should be called by challenger and solver
     * to decide on the outcome.
     *
     * Requirements:
     *  - last execution step must end with either REVERT, RETURN or STOP to be considered complete
     *  - any execution step which does not have errno = 0 or errno = 0x07 (REVERT)
     *    is considered invalid
     *  - the left-most (first) execution step must be a `Merkelizer.initialStateHash`
     *
     * Note: if that doesnt happen, this will finally timeout and a final decision is made
     *       in `claimTimeout`.
     */
    // solhint-disable-next-line code-complexity
    function submitProof(
        bytes32 disputeId,
        Proofs memory proofs,
        Merkelizer.ExecutionState memory executionState
        // solhint-disable-next-line function-max-lines
    ) public onlyPlaying(disputeId) {
        Dispute storage dispute = disputes[disputeId];
        require(dispute.treeDepth == 0, "Not at leaf yet");

        // TODO: all sanity checks should go in a common function
        if (executionState.stack.length > executionState.stackSize) {
            return;
        }
        if (executionState.mem.length > executionState.memSize) {
            return;
        }

        // TODO: verify all inputs, check access pattern(s) for memory, calldata, stack
        bytes32 dataHash = executionState.data.length != 0 ? Merkelizer.dataHash(executionState.data) : proofs.dataHash;
        bytes32 memHash = executionState.mem.length != 0 ? Merkelizer.memHash(executionState.mem) : proofs.memHash;

        bytes32 inputHash = executionState.stateHash(
            executionState.stackHash(proofs.stackHash),
            memHash,
            dataHash
        );

        if ((inputHash != dispute.solver.left && inputHash != dispute.challenger.left) ||
            ((dispute.state & START_OF_EXECUTION) != 0 && inputHash != dispute.initialStateHash)) {
            return;
        }
        if (dispute.witness != bytes32(0)) {
            if (inputHash != dispute.witness) {
                return;
            }
        }

        if ((dispute.state & END_OF_EXECUTION) != 0) {
            // TODO: support both code from bytes and from address (Future PR)
            address codeAddress = address(bytes20(dispute.codeHash));
            uint pos = executionState.pc;
            uint8 opcode;

            assembly {
                extcodecopy(codeAddress, 31, pos, 1)
                opcode := mload(0)
            }

            if (opcode != OP_REVERT && opcode != OP_RETURN && opcode != OP_STOP) {
                return;
            }
        }

        EVM memory evm;
        HydratedState memory hydratedState = initHydratedState(evm);

        hydratedState.stackHash = proofs.stackHash;
        hydratedState.memHash = memHash;

        evm.context = Context(
            DEFAULT_CALLER,
            0,
            DEFAULT_BLOCK_GAS_LIMIT,
            0,
            0,
            0,
            0
        );

        evm.data = executionState.data;
        evm.gas = executionState.gasRemaining;
        evm.code = EVMCode.fromAddress(address(bytes20(dispute.codeHash)));
        evm.caller = DEFAULT_CALLER;
        evm.target = DEFAULT_CONTRACT_ADDRESS;
        evm.stack = EVMStack.fromArray(executionState.stack);
        evm.mem = EVMMemory.fromArray(executionState.mem);

        _run(evm, executionState.pc, 1);

        if (evm.errno != NO_ERROR && evm.errno != ERROR_STATE_REVERTED) {
            return;
        }

        executionState.pc = evm.pc;
        executionState.returnData = evm.returnData;
        executionState.gasRemaining = evm.gas;

        if (executionState.stack.length > executionState.stackSize) {
            return;
        }

        uint stackSize = executionState.stackSize - executionState.stack.length;

        executionState.stackSize = evm.stack.size + stackSize;
        // stackSize cant be bigger than 1024 (stack limit)
        if (executionState.stackSize > MAX_STACK_SIZE) {
            return;
        }

        // will be changed once we land merkle tree for memory
        if (evm.mem.size > 0) {
            executionState.memSize = evm.mem.size;
        }

        bytes32 hash = executionState.stateHash(
            hydratedState.stackHash,
            hydratedState.memHash,
            dataHash
        );

        if (hash != dispute.solver.right && hash != dispute.challenger.right) {
            return;
        }

        if (hash == dispute.solver.right && executionState.memSize < MAX_MEM_WORD_COUNT) {
            dispute.state |= SOLVER_VERIFIED;
        }

        if (hash == dispute.challenger.right) {
            dispute.state |= CHALLENGER_VERIFIED;
        }

        if (dispute.state & SOLVER_VERIFIED != 0) {
            enforcer.result(dispute.executionId, true, dispute.challengerAddr);
        } else {
            enforcer.result(dispute.executionId, false, dispute.challengerAddr);
        }
    }

    /*
     * When claimTimeout is called, the dispute must not be resolved
     *  Hence, there are 3 cases:
     *  - Nobody has responded
     *  - Solver has responded, challenger hasn't: Solver wins
     *  - Solver has not responded, challenger has: Challenger wins
     * The case both have responded is not exist because if both responded, updateRound would has been called
     *  and reset timeout and states
     * The case "Nobody has responded" has 2 subcases:
     *  - Before last turn: Solver wins, because we assume that challenger is the one who requested the dispute and has more responsibility
     *  - Last turn: Challenger wins. Here, somebody should call submitProof. If it is not called, it should be solver's fault,
     *      because it could be something only solver knows
     */
    function claimTimeout(bytes32 disputeId) public {
        Dispute storage dispute = disputes[disputeId];

        require(dispute.timeout > 0, "dispute not exist");
        require(dispute.timeout < block.number, "not timed out yet");
        require(
            (dispute.state & SOLVER_VERIFIED) == 0 && (dispute.state & CHALLENGER_VERIFIED) == 0,
            "already notified enforcer"
        );

        bool solverWins;

        if ((dispute.state & SOLVER_RESPONDED) != 0) {
            solverWins = true;
        } else if ((dispute.state & CHALLENGER_RESPONDED) != 0) {
            solverWins = false;
        } else {
            solverWins = (dispute.treeDepth > 0);
        }

        if (solverWins) {
            dispute.state |= SOLVER_VERIFIED;
        } else {
            dispute.state |= CHALLENGER_VERIFIED;
        }

        enforcer.result(dispute.executionId, solverWins, dispute.challengerAddr);
    }

    /**
      * @dev refresh timeout of dispute
      */
    function getTimeout() internal view returns (uint256) {
        return block.number + timeoutDuration;
    }

    /**
      * @dev updateRound runs every time after receiving a respond
      *         assume that both solver and challenger have the same tree depth
      */
    // solhint-disable-next-line code-complexity, function-max-lines
    function updateRound(bytes32 disputeId, Dispute storage dispute, ComputationPath memory witnessPath) internal {
        if ((dispute.state & SOLVER_RESPONDED) == 0 || (dispute.state & CHALLENGER_RESPONDED) == 0) {
            return;
        }

        // left can not be zero
        if (dispute.solver.left == bytes32(0)) {
            enforcer.result(dispute.executionId, false, dispute.challengerAddr);
            dispute.state |= CHALLENGER_VERIFIED;
            return;
        }
        if (dispute.challenger.left == bytes32(0)) {
            enforcer.result(dispute.executionId, true, dispute.challengerAddr);
            dispute.state |= SOLVER_VERIFIED;
            return;
        }

        if (dispute.witness != bytes32(0)) {
            require(
                keccak256(abi.encodePacked(witnessPath.left, witnessPath.right)) == dispute.witness
            );

            dispute.witness = witnessPath.right;
        }

        // refresh state and timeout
        dispute.timeout = getTimeout();
        dispute.state ^= SOLVER_RESPONDED | CHALLENGER_RESPONDED;

        dispute.treeDepth -= 1;

        if ((dispute.solver.left == dispute.challenger.left) &&
            (dispute.solver.right != 0) &&
            (dispute.challenger.right != 0)) {
            // following right
            dispute.witness = dispute.solver.left;
            dispute.solverPath = dispute.solver.right;
            dispute.challengerPath = dispute.challenger.right;

            if ((dispute.state & START_OF_EXECUTION) != 0) {
                dispute.state ^= START_OF_EXECUTION;
            }
        } else {
            // following left
            dispute.solverPath = dispute.solver.left;
            dispute.challengerPath = dispute.challenger.left;

            if (dispute.solver.right != 0) {
                if ((dispute.state & END_OF_EXECUTION) != 0) {
                    dispute.state ^= END_OF_EXECUTION;
                }
            }
        }
        emit DisputeNewRound(disputeId, dispute.timeout, dispute.solverPath, dispute.challengerPath);
    }
}
