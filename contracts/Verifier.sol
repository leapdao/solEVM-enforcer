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
        address codeContractAddress;
        address challengerAddr;

        bytes32 solverPath;
        uint256 solverDepth;
        bytes32 challengerPath;
        uint256 challengerDepth;

        ComputationPath solver;
        ComputationPath challenger;

        uint8 state;

        uint256 timeout; // currently is block number
    }

    event DisputeNewRound(bytes32 indexed disputeId, uint256 timeout, bytes32 solverPath, bytes32 challengerPath);
    event ProofSubmitted(uint256 solverDepth, uint256 challengerDepth);

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
        require(disputes[disputeId].timeout >= block.number, "game timed out");
        _;
    }

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
        bytes32 initialStateHash,
        bytes32 solverHashRoot,
        uint256 solverExecutionDepth,
        bytes32 challengerHashRoot,
        uint256 challengerExecutionDepth,
        address challenger,
        address codeContractAddress
    ) public onlyEnforcer() returns (bytes32 disputeId) {
        disputeId = keccak256(
            abi.encodePacked(
                executionId,
                initialStateHash,
                solverHashRoot,
                solverExecutionDepth,
                challengerHashRoot,
                challengerExecutionDepth
            )
        );

        require(disputes[disputeId].timeout == 0, "already init");
        // do we want to prohibit early?
        // require(solverHashRoot != challengerHashRoot, "nothing to challenge");

        disputes[disputeId] = Dispute(
            executionId,
            initialStateHash,
            codeContractAddress,
            challenger,
            solverHashRoot,
            solverExecutionDepth,
            challengerHashRoot,
            challengerExecutionDepth,
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
        ComputationPath memory computationPath
    ) public onlyPlaying(disputeId) {

        Dispute storage dispute = disputes[disputeId];

        bytes32 h = keccak256(abi.encodePacked(computationPath.left, computationPath.right));

        require(
            h == dispute.solverPath || h == dispute.challengerPath,
            "wrong path submitted"
        );

        if ((h == dispute.solver.left) || (h == dispute.solver.right) && dispute.solverDepth >= dispute.challengerDepth) {
            dispute.state |= SOLVER_RESPONDED;
            dispute.solver = computationPath;
        }

        if ((h == dispute.challenger.left) || (h == dispute.challenger.right) && dispute.challengerDepth >= dispute.solverDepth) {
            dispute.state |= CHALLENGER_RESPONDED;
            dispute.challenger = computationPath;
        }

        // TODO: do we really want to refresh the timeout?
        // dispute.timeout = getTimeout();

        updateRound(dispute);
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
        require(dispute.solverDepth == 0 && dispute.challengerDepth == 0, "Not at leaf yet");

        bytes32 inputHash = executionState.stateHash(
            executionState.stackHash(proofs.stackHash),
            proofs.memHash,
            proofs.dataHash
        );

        if ((inputHash != dispute.solver.left && inputHash != dispute.challenger.left) ||
            ((dispute.state & START_OF_EXECUTION) != 0 && inputHash != dispute.initialStateHash)) {
            return;
        }

        if ((dispute.state & END_OF_EXECUTION) != 0) {
            address codeAddress = dispute.codeContractAddress;
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
        hydratedState.memHash = proofs.memHash;
        hydratedState.logHash = executionState.logHash;

        evm.context = Context(
            DEFAULT_CALLER,
            0,
            BLOCK_GAS_LIMIT,
            0,
            0,
            0,
            0
        );

        evm.data = executionState.data;
        evm.gas = executionState.gasRemaining;

        EVMAccounts.Account memory caller = evm.accounts.get(DEFAULT_CALLER);
        caller.nonce = uint8(1);

        EVMAccounts.Account memory target = evm.accounts.get(DEFAULT_CONTRACT_ADDRESS);
        target.code = EVMCode.fromAddress(dispute.codeContractAddress);

        evm.caller = evm.accounts.get(DEFAULT_CALLER);
        evm.target = evm.accounts.get(DEFAULT_CONTRACT_ADDRESS);

        evm.code = evm.target.code;
        evm.stack = EVMStack.fromArray(executionState.stack);
        evm.mem = EVMMemory.fromArray(executionState.mem);

        _run(evm, executionState.pc, 1);

        if (evm.errno != NO_ERROR && evm.errno != ERROR_STATE_REVERTED) {
            return;
        }

        executionState.pc = evm.pc;
        executionState.logHash = hydratedState.logHash;
        executionState.returnData = evm.returnData;
        executionState.gasRemaining = evm.gas;

        bytes32 hash = executionState.stateHash(
            hydratedState.stackHash,
            hydratedState.memHash,
            proofs.dataHash
        );

        if (hash != dispute.solver.right && hash != dispute.challenger.right) {
            return;
        }

        if (hash == dispute.solver.right) {
            dispute.state |= SOLVER_VERIFIED;
        }

        if (hash == dispute.challenger.right) {
            dispute.state |= CHALLENGER_VERIFIED;
        }

        if ((dispute.state & SOLVER_VERIFIED) != 0 && (dispute.state & CHALLENGER_VERIFIED) != 0) {
            // both are verified, solver wins
            enforcer.result(dispute.executionId, true, dispute.challengerAddr);
        }
    }

    function claimTimeout(bytes32 disputeId) public {
        Dispute storage dispute = disputes[disputeId];

        require(dispute.timeout > 0, "dispute not exit");
        require(dispute.timeout < block.number, "not timed out yet");
        require(
            !((dispute.state & SOLVER_VERIFIED) != 0 && (dispute.state & CHALLENGER_VERIFIED) != 0),
            "already notified enforcer"
        );

        bool solverWins = true;

        if ((dispute.state & CHALLENGER_VERIFIED) != 0 || (dispute.state & CHALLENGER_RESPONDED) != 0) {
            solverWins = false;
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
      *     If solver depth is higher than challenger depth
      *         update solver tree
      *     If solver depth is less than challenger depth
      *         update challenger tree
      *     Else update both tree
      */
    function updateRound(Dispute storage dispute) internal {
        // if solver depth is higher, only update solver tree
        emit ProofSubmitted(dispute.solverDepth, dispute.challengerDepth);
        if (dispute.solverDepth > dispute.challengerDepth) {
            if (dispute.state & SOLVER_RESPONDED != 0) {
                // follow to the left by default
                dispute.solverPath = dispute.solver.left;
                dispute.solverDepth -= 1;
                dispute.state ^= SOLVER_RESPONDED;
                emit DisputeNewRound(dispute.executionId, dispute.timeout, dispute.solverPath, dispute.challengerPath);
            } else {
                // TODO this means CHALLENGER_RESPONDED unnecessary, should be ignored
                dispute.state ^= CHALLENGER_RESPONDED;
            }
            return;
        }

        // if solver depth is lower, only update challenger tree
        if (dispute.solverDepth < dispute.challengerDepth) {
            if (dispute.state & CHALLENGER_RESPONDED != 0) {
                // follow to the left by default
                dispute.challengerPath = dispute.challenger.left;
                dispute.challengerDepth -= 1;
                dispute.state ^= CHALLENGER_RESPONDED;
                emit DisputeNewRound(dispute.executionId, dispute.timeout, dispute.solverPath, dispute.challengerPath);
            } else {
                // TODO this means SOLVER_RESPONDED unnecessary, should be ignored
                dispute.state ^= SOLVER_RESPONDED;
            }
            return;
        }

        if ((dispute.state & SOLVER_RESPONDED) == 0 || (dispute.state & CHALLENGER_RESPONDED) == 0) {
            return;
        }

        dispute.state ^= SOLVER_RESPONDED | CHALLENGER_RESPONDED;

        // solver depth should now equal to challenger depth
        dispute.solverDepth -= 1;
        dispute.challengerDepth -= 1;

        if ((dispute.solver.left == dispute.challenger.left) &&
            (dispute.solver.right != 0) &&
            (dispute.challenger.right != 0)) {
            // following right
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
        emit DisputeNewRound(dispute.executionId, dispute.timeout, dispute.solverPath, dispute.challengerPath);
    }

    function handleCREATE(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleCREATE2(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleCALL(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleDELEGATECALL(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleSTATICCALL(EVM memory state) internal {
        // TODO: only support precompiles
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleCALLCODE(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleEXTCODEHASH(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }
}
