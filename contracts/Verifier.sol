pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import "./EVMConstants.sol";
import "./IEnforcer.sol";
import "./IVerifier.sol";
import "./IEthereumRuntime.sol";
import "./Merkelizer.slb";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract Verifier is EVMConstants, Ownable {
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
        bytes32 initialStateHash;
        address codeContractAddress;
        address challengerAddr;

        bytes32 solverPath;
        bytes32 challengerPath;

        ComputationPath solver;
        ComputationPath challenger;

        uint8 state;

        uint256 timeout; // currently is block number
    }

    event DisputeInitialised(bytes32 indexed disputeId, address challenger, bytes32 indexed executionId, uint256 timeout);
    event DisputeNewRound(bytes32 indexed disputeId, uint256 timeout, bytes32 solverPath, bytes32 challengerPath);

    uint256 public timeoutDuration;

    IEnforcer public enforcer;
    IEthereumRuntime public ethRuntime;

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

    constructor(uint256 _timeout) public Ownable() {
        timeoutDuration = _timeout;
    }

    function setEnforcer(address _enforcer) public onlyOwner() {
        enforcer = IEnforcer(_enforcer);
    }

    function setRuntime(address _ethruntime) public onlyOwner() {
        ethRuntime = IEthereumRuntime(_ethruntime);
    }

    /**
      * @dev init a new dispute, only callable by enforcer
      */
    function initGame(
        bytes32 _initialStateHash,
        bytes32 _solverHashRoot,
        uint256 _solverExecutionLength,
        bytes32 _challengerHashRoot,
        address _challenger,
        address _codeContractAddress
    ) public onlyEnforcer() {
        bytes32 disputeId = keccak256(
            abi.encodePacked(
                _initialStateHash,
                _solverHashRoot,
                _solverExecutionLength,
                _challengerHashRoot
            )
        );

        require(disputes[disputeId].timeout == 0, "already init");
        // do we want to prohibit early?
        //require(_solverHashRoot != _challengerHashRoot, "nothing to challenge");

        disputes[disputeId] = Dispute(
            _initialStateHash,
            _codeContractAddress,
            _challenger,
            _solverHashRoot,
            _challengerHashRoot,
            ComputationPath(_solverHashRoot, _solverHashRoot),
            ComputationPath(_challengerHashRoot, _challengerHashRoot),
            INITIAL_STATE,
            getTimeout()
        );

        emit DisputeInitialised(disputeId, _challenger, _initialStateHash, disputes[disputeId].timeout);
    }

    /*
     * Solver or Challenger always respond with the next `ComputationPath`
     * for the path they do not agree on.
     * If they do not agree on both `left` and `right` they must follow/default
     * to `left`.
     */
    function respond(
        bytes32 _disputeId,
        ComputationPath memory _computationPath
    ) public onlyPlaying(_disputeId) {

        Dispute storage dispute = disputes[_disputeId];

        bytes32 h = keccak256(abi.encodePacked(_computationPath.left, _computationPath.right));

        require(
            h == dispute.solverPath || h == dispute.challengerPath,
            "wrong path submitted"
        );

        if ((h == dispute.solver.left) || (h == dispute.solver.right)) {
            dispute.state |= SOLVER_RESPONDED;
            dispute.solver = _computationPath;
        }

        if ((h == dispute.challenger.left) || (h == dispute.challenger.right)) {
            dispute.state |= CHALLENGER_RESPONDED;
            dispute.challenger = _computationPath;
        }

        // TODO: do we really want to refresh the timeout?
        // dispute.timeout = getTimeout();

        if ((dispute.state & SOLVER_RESPONDED) != 0 && (dispute.state & CHALLENGER_RESPONDED) != 0) {
            updateRound(dispute);
            emit DisputeNewRound(_disputeId, dispute.timeout, dispute.solverPath, dispute.challengerPath);
        }
    }

    /*
     * if they agree on `left` but not on `right`,
     * submitProof (on-chain) verification should be called by challenger and solver
     * to decide on the outcome.
     *
     * Requirements:
     *  - last execution step must end with either REVERT or RETURN to be considered complete
     *  - any execution step which does not have errno = 0 or errno = 0x07 (REVERT)
     *    is considered invalid
     *  - the left-most (first) execution step must be a `Merkelizer.initialStateHash`
     *
     * Note: if that doesn't happen, this will finally timeout and a final decision is made
     *       in `claimTimeout`.
     */
    // solhint-disable-next-line code-complexity
    function submitProof(
        bytes32 _disputeId,
        Proofs memory _proofs,
        Merkelizer.ExecutionState memory _executionState
        // solhint-disable-next-line function-max-lines
    ) public onlyPlaying(_disputeId) {
        Dispute storage dispute = disputes[_disputeId];

        bytes32 inputHash = _executionState.stateHash(
            _executionState.stackHash(_proofs.stackHash),
            _proofs.memHash,
            _proofs.dataHash
        );

        if ((inputHash != dispute.solver.left && inputHash != dispute.challenger.left) ||
            ((dispute.state & START_OF_EXECUTION) != 0 && inputHash != dispute.initialStateHash)) {
            return;
        }

        uint pc = _executionState.pc;
        uint codeptr = 0;
        uint codeSize = 0;
        address codeContractAddress = dispute.codeContractAddress;

        // TODO: what happens if the code make assumptions with OP.PC ?
        //       should we pad the code array with zeros?
        //       -
        //       we can do some prechecks without running the evm for:
        //       - JUMP, JUMPI
        //       - CODESIZE
        //       - maybe others too
        if (_executionState.isCodeCompacted) {
            uint pcEnd = _executionState.pcEnd;

            if (pc == pcEnd) {
                pcEnd += 1;
            }

            codeSize = pcEnd - pc;
            codeptr = pc;
            _executionState.pc = 0;
        } else {
            assembly {
                codeSize := extcodesize(codeContractAddress)
            }
        }

        bytes memory code = new bytes(codeSize);
        assembly {
            extcodecopy(codeContractAddress, add(code, 0x20), codeptr, codeSize)
        }

        if ((dispute.state & END_OF_EXECUTION) != 0) {
            if (uint8(code[_executionState.pc]) != OP_REVERT && uint8(code[_executionState.pc]) != OP_RETURN) {
                return;
            }
        }

        IEthereumRuntime.EVMPreimage memory img;
        img.code = code;
        img.data = _executionState.data;
        img.pc = _executionState.pc;
        img.stepCount = 1;
        img.gasLimit = BLOCK_GAS_LIMIT;
        img.gasRemaining = _executionState.gasRemaining;
        img.stack = _executionState.stack;
        img.mem = _executionState.mem;
        img.logHash = _executionState.logHash;

        IEthereumRuntime.EVMResult memory resultState;
        resultState = ethRuntime.execute(img);

        if (resultState.errno != 0 && resultState.errno != 0x07) {
            return;
        }

        _executionState.pc = resultState.pc;
        _executionState.stack = resultState.stack;
        _executionState.mem = resultState.mem;
        _executionState.logHash = resultState.logHash;
        _executionState.returnData = resultState.returnData;
        _executionState.gasRemaining = resultState.gas;

        // patch
        if (_executionState.isCodeCompacted) {
            _executionState.pc += pc;
        }

        bytes32 hash = _executionState.stateHash(
            _executionState.stackHash(_proofs.stackHash),
            _proofs.memHash, _proofs.dataHash
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
            // enforcer.result(_disputeId, true, dispute.challengerAddr);
        }
    }

    function claimTimeout(bytes32 _disputeId) public {
        Dispute storage dispute = disputes[_disputeId];

        require(dispute.timeout > 0, "dispute not exit");
        require((dispute.state & SOLVER_VERIFIED) != 0 && (dispute.state & CHALLENGER_VERIFIED) != 0, "already notified enforcer");
        require(dispute.timeout < block.number, "not timed out yet");

        bool solverWins = true;

        if ((dispute.state & CHALLENGER_VERIFIED) != 0 || (dispute.state & CHALLENGER_RESPONDED) != 0) {
            solverWins = false;
        }

        enforcer.result(_disputeId, solverWins, dispute.challengerAddr);
    }

    /**
      * @dev refresh timeout of dispute
      */
    function getTimeout() internal view returns (uint256) {
        return block.number + timeoutDuration;
    }

    function updateRound(Dispute storage _dispute) internal {
        _dispute.state ^= SOLVER_RESPONDED | CHALLENGER_RESPONDED;

        if ((_dispute.solver.left == _dispute.challenger.left) &&
            (_dispute.solver.right != 0) &&
            (_dispute.challenger.right != 0)) {
            // following right
            _dispute.solverPath = _dispute.solver.right;
            _dispute.challengerPath = _dispute.challenger.right;

            if ((_dispute.state & START_OF_EXECUTION) != 0) {
                _dispute.state ^= START_OF_EXECUTION;
            }
        } else {
            // following left
            _dispute.solverPath = _dispute.solver.left;
            _dispute.challengerPath = _dispute.challenger.left;

            if (_dispute.solver.right != 0) {
                if ((_dispute.state & END_OF_EXECUTION) != 0) {
                    _dispute.state ^= END_OF_EXECUTION;
                }
            }
        }
    }
}
