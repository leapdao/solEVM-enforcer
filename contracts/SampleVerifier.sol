pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "./IEnforcer.sol";
import "./IVerifier.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


library CompactExecution {
    struct StateHash {
        bytes32 hash;
        uint256 step;
    }

    struct ComputationHash {
        bytes32 merkleRoot;
        uint256 stepCount;
    }
}


contract SampleVerifier is Ownable, IVerifier {

    enum Results { SolverCorrect, ChallengerCorrect, Undecided }
    enum States { Initialised, SolverTurn, ChallengerTurn, FoundDiff, Ended }

    event DisputeInitialised(address solver, address challenger, bytes32 executionId, uint256 timeout);

    struct Dispute {
        address solver;
        address challenger;
        CompactExecution.ComputationHash solverComputationHash;
        CompactExecution.ComputationHash challengerComputationHash;
        CompactExecution.StateHash left;
        CompactExecution.StateHash right;
        uint256 timeout; // currently is block number
        States state;
        Results result;
    }

    address public owner;
    uint256 public timeoutDuration;

    IEnforcer public enforcer;

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
            CompactExecution.ComputationHash(_solverHashRoot, _solverStep),
            CompactExecution.ComputationHash(_challengerHashRoot, _challengerStep),
            CompactExecution.StateHash("", 0),
            CompactExecution.StateHash("", 0),
            block.number + timeoutDuration,
            States.Initialised,
            Results.Undecided
        );

        emit DisputeInitialised(_solver, _challenger, _executionId, disputes[_executionId].timeout);
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
        bytes32[] endProofs
    ) public onlySolver(disputeId) onlyInitialised(disputeId) onlyPlaying(disputeId) {
        Dispute storage dispute = disputes[disputeId];
        // TODO check proofs
        if (true) {
            dispute.left = CompactExecution.StateHash(startProofs[0], 0);
            dispute.right = CompactExecution.StateHash(endProofs[0], dispute.solverComputationHash.stepCount);
            dispute.state = States.SolverTurn;
        } else {
            // solver lost immediately
            dispute.state = States.Ended;
            dispute.result = Results.ChallengerCorrect;
            enforcer.result(disputeId, false, dispute.challenger);
        }
    }

}
