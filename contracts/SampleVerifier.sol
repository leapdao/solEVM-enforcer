pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "./IEnforcer.sol";
import "./IVerifier.sol";
import "./IEthereumRuntime.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./MerkleProof.slb";


// solhint-disable-next-line max-states-count
contract SampleVerifier is Ownable, IVerifier {
    struct StateHash {
        bytes32 hash;
        uint256 step;
    }

    struct ComputationHash {
        bytes32 merkleRoot;
        uint256 stepCount;
    }

    struct Dispute {
        address solver;
        address challenger;
        ComputationHash solverComputationHash;
        ComputationHash challengerComputationHash;
        StateHash left;
        StateHash right;
        uint256 timeout; // currently is block number
        States state;
        Results result;
    }

    enum Results { SolverCorrect, ChallengerCorrect, Undecided }
    enum States { Initialised, SolverTurn, ChallengerTurn, FoundDiff, Ended }

    event DisputeInitialised(address solver, address challenger, bytes32 executionId, uint256 timeout);


    address public owner;
    uint256 public timeoutDuration;

    IEnforcer public enforcer;
    IEthereumRuntime public ethRuntime;

    mapping (bytes32 => Dispute) public disputes;

    constructor(uint256 _timeout) public {
        owner = msg.sender;
        timeoutDuration = _timeout;
    }

    function setEnforcer(address _enforcer) public onlyOwner() {
        enforcer = IEnforcer(_enforcer);
    }

    /**
      * @dev Throw if not called by enforcer
      */
    modifier onlyEnforcer() {
        require(msg.sender == address(enforcer), "only enforcer");
        _;
    }

    /**
      * @dev init a new dispute, only callable by enforcer
      */
    function initGame(
        bytes32 _executionId,
        bytes32 _solverHashRoot,
        uint256 _solverStep,
        bytes32 _challengerHashRoot,
        uint256 _challengerStep,
        address _solver,
        address _challenger
    ) public onlyEnforcer() {
        require(disputes[_executionId].timeout == 0, "already init");
        require(_solverHashRoot != _challengerHashRoot, "nothing to challenge");

        disputes[_executionId] = Dispute(
            _solver,
            _challenger,
            ComputationHash(_solverHashRoot, _solverStep),
            ComputationHash(_challengerHashRoot, _challengerStep),
            StateHash("", 0),
            StateHash("", 0),
            block.number + timeoutDuration,
            States.Initialised,
            Results.Undecided
        );

        emit DisputeInitialised(_solver, _challenger, _executionId, disputes[_executionId].timeout);
    }

    function setRuntime(address _ethruntime) public onlyOwner() {
        ethRuntime = IEthereumRuntime(_ethruntime);
    }

    /**
      * @dev game not timeout yet
      */
    modifier onlyPlaying(bytes32 disputeId) {
        require(disputes[disputeId].timeout >= block.number, "game timed out");
        _;
    }

    /**
      * @dev only run when a game in Initialised state
      */
    modifier onlyInitialised(bytes32 disputeId) {
        require(disputes[disputeId].state == States.Initialised, "game not initialised");
        _;
    }

    /**
      * @dev only run when a game in Initialised state
      */
    modifier onlyInitialised(bytes32 disputeId) {
        require(disputes[disputeId].state == States.Initialised, "game not initialised");
        _;
    }

    /**
      * @dev only allow solver
      */
    modifier onlySolver(bytes32 disputeId) {
        require(disputes[disputeId].solver == msg.sender, "sender not solver");
        _;
    }

    /**
      * @dev only allow challenger
      */
    modifier onlyChallenger(bytes32 disputeId) {
        require(disputes[disputeId].challenger == msg.sender, "sender not challenger");
        _;
    }

    /**
      * @dev solver submits initial execution state proofs
      */
    function solverProofs(
        bytes32 disputeId,
        bytes32[] startProofs,
        bytes32 startHash,
        bytes32[] endProofs,
        bytes32 endHash
    ) public onlySolver(disputeId) onlyInitialised(disputeId) onlyPlaying(disputeId) {

        Dispute storage dispute = disputes[disputeId];
        if (MerkleProof.verify(startProofs, dispute.solverComputationHash.merkleRoot, startHash, 0) &&
            MerkleProof.verify(endProofs, dispute.solverComputationHash.merkleRoot, endHash, dispute.solverComputationHash.stepCount)) {
            dispute.left = StateHash(startHash, 0);
            dispute.right = StateHash(endHash, dispute.solverComputationHash.stepCount);
            dispute.state = States.SolverTurn;
        } else {
            // solver lost immediately
            dispute.state = States.Ended;
            dispute.result = Results.ChallengerCorrect;
            enforcer.result(disputeId, false, dispute.challenger);
        }
    }

    /**
      * @dev run once found the different step of a dispute
      */
    function detailExecution(
        bytes32 disputeId,
        bytes code,
        bytes32[] codeProof,
        uint256[] params,
        bytes32[] stack,
        bytes32 stackHash,
        bytes32 mem,
        uint256 memPos,
        bytes32[] memProof,
        bytes32 logHash
    ) public onlyFoundDiff(disputeId) onlyPlaying(disputeId) {
        Dispute storage dispute = disputes[disputeId];

        require(dispute.left.step == dispute.right.step - 1, "must find a specific step");

        // calculate code root from code and codeProof, code pos is pcStart
        code;
        codeProof;
        // calculate stack hash from stack and stackHash
        stack;
        stackHash;
        // calculate mem hash root from mem and proof
        mem;
        memPos;
        memProof;
        // CompactMemory
        // verify left state
        params[1] = 1; // run 1 step, should not take this value into hash function
        // since we may not be able to verify blockhash, should we skip that?
        // TODO data
        // TODO account
        logHash;

        IEthereumRuntime.Result result = ethRuntime.execute(code, "", params, stack, mem, [], "", logHash);

        // Hash result to check with right
        if (true) {
            dispute.result = Results.SolverCorrect;
        } else {
            dispute.result = Results.ChallengerCorrect;
        }
        dispute.state = States.Ended;
        enforcer.result(disputeId, true, dispute.challenger);
    }
}
