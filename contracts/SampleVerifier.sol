pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./IEnforcer.sol";
import "./IVerifier.sol";
import "./IEthereumRuntime.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./MerkleProof.slb";
import "./Hash.slb";


// solhint-disable-next-line max-states-count
contract SampleVerifier is Ownable, IVerifier {
    struct StateHash {
        bytes32 hash;
        uint256 step;
    }

    struct ComputationHash {
        bytes32 merkleRoot;
        uint256 executionLength;
    }

    struct Dispute {
        bytes32 executionId;
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

    event DisputeInitialised(bytes32 indexed disputeId, address challenger, bytes32 indexed executionId, uint256 timeout);

    uint256 public timeoutDuration;

    IEnforcer public enforcer;
    IEthereumRuntime public ethRuntime;

    mapping (bytes32 => Dispute) public disputes;

    using Hash for uint256[];

    constructor(uint256 _timeout) public Ownable() {
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
        uint256 _solverExecutionLength,
        bytes32 _challengerHashRoot,
        uint256 _challengerExecutionLength,
        address _challenger
    ) public onlyEnforcer() {
        bytes32 disputeId = keccak256(abi.encodePacked(_executionId, _challenger));
        require(disputes[disputeId].timeout == 0, "already init");
        require(_solverHashRoot != _challengerHashRoot, "nothing to challenge");

        disputes[disputeId] = Dispute(
            _executionId,
            _challenger,
            ComputationHash(_solverHashRoot, _solverExecutionLength),
            ComputationHash(_challengerHashRoot, _challengerExecutionLength),
            StateHash("", 0),
            StateHash("", 0),
            getTimeout(),
            States.Initialised,
            Results.Undecided
        );

        emit DisputeInitialised(disputeId, _challenger, _executionId, disputes[disputeId].timeout);
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
    modifier onlyFoundDiff(bytes32 disputeId) {
        require(disputes[disputeId].state == States.FoundDiff, "game not found diff");
        _;
    }

    /**
      * @dev submits initial execution state proofs
      *   anyone can submit these initial state proofs as long as
      *   the proofs match the submitted merkle root
      *   Currently only take into account the merkle root of solver
      */
    function solverProofs(
        bytes32 disputeId,
        bytes32[] memory startProofs,
        bytes32 startHash,
        bytes32[] memory endProofs,
        bytes32 endHash
    ) public onlyInitialised(disputeId) onlyPlaying(disputeId) {

        Dispute storage dispute = disputes[disputeId];
        require(MerkleProof.verify(startProofs, dispute.solverComputationHash.merkleRoot, startHash, 0), "start state proof not correct");
        // TODO verify length of proofs match step
        // solhint-disable-next-line max-line-length
        require(MerkleProof.verify(endProofs, dispute.solverComputationHash.merkleRoot, endHash, dispute.solverComputationHash.executionLength - 1), "end state proof not correct");

        dispute.left = StateHash(startHash, 0);
        dispute.right = StateHash(endHash, dispute.solverComputationHash.executionLength - 1);
        dispute.state = States.SolverTurn;
        dispute.timeout = getTimeout();
    }

    /**
      * @dev run once found the different step of a dispute
      */
    function detailExecution(
        bytes32 disputeId,
        // bytes32[] codeProof,
        // uint256[] stackSiblingHash,
        // uint256 memPos,
        // bytes32[] memProof,
        IEthereumRuntime.EVMPreimage memory img
    ) public onlyFoundDiff(disputeId) onlyPlaying(disputeId) {
        Dispute storage dispute = disputes[disputeId];

        require(dispute.left.step == dispute.right.step - 1, "must find a specific step");
        // only allow to run 1 step
        require(img.stepCount == 1, "must be one step");

        // TODO actual procedure:
        // - calculate code root from code and codeProof, code pos is pcStart
        //      code is actually more complicated to workwith
        //      we may need 1 byte + 32 bytes of code to run 1 opcode
        // - calculate stack hash from stack and stackSiblingHash
        // - calculate mem hash root from mem, memPos and memProof
        // - combine to actual state hash to verify left state
        require(img.stack.toHash() == dispute.left.hash, "state hash not match");
        // require(img.hashValue == dispute.left.hash, "state hash not match");

        IEthereumRuntime.EVMResult memory result = ethRuntime.execute(img);
        // TODO calculate state hash
        bytes32 resultHash = result.stack.toHash();

        // TODO use actual state hash to verify right state
        if (resultHash == dispute.right.hash) {
            dispute.result = Results.SolverCorrect;
        } else {
            dispute.result = Results.ChallengerCorrect;
        }
        dispute.state = States.Ended;
        enforcer.result(disputeId, true, dispute.challenger);
    }

    /**
      * @dev can be called by anyone after the dispute is over
      *   Solver are considered lost if the dispute is timed out in any of:
      *     Initialised SolverTurn FoundDiff
      *   Challenger is considered lost if the dispute is timed out in
      *     ChallengerTurn
      */
    function claimTimeout(bytes32 disputeId) public {
        Dispute storage dispute = disputes[disputeId];

        require(dispute.timeout > 0, "dispute not exit");
        require(dispute.state != States.Ended, "already notifier enforcer");
        require(dispute.timeout < block.number, "not timed out yet");

        bool res;
        if (dispute.state == States.ChallengerTurn) {
            // consider solver correct
            dispute.result = Results.SolverCorrect;
            res = true;
        } else { // Initialised SolverTurn FoundDiff
            dispute.result = Results.ChallengerCorrect;
            res = false;
        }
        dispute.state = States.Ended;
        enforcer.result(disputeId, res, dispute.challenger);
    }

    /**
      * @dev refresh timeout of dispute
      */
    function getTimeout() internal view returns (uint256) {
        return block.number + timeoutDuration;
    }
}
