pragma solidity 0.4.24;
pragma experimental ABIEncoderV2;

import "./IEnforcer.sol";
import "./IVerifier.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";



contract SampleVerifier is Ownable, IVerifier {

    enum Results { SolverCorrect, ChallengerCorrect, Undecided }

    event DisputeInitialised(address solver, address challenger, bytes32 executionId, uint256 timeout);

    struct Dispute {
        address solver;
        address challenger;
        CompactExecution.ComputationHash solverComputationHash;
        CompactExecution.ComputationHash challengerComputationHash;
        CompactExecution.StateHash left;
        CompactExecution.StateHash right;
        uint256 timeout; // currently is block number
        bool foundDiff;
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
            false,
            Results.Undecided
        );

        emit DisputeInitialised(_solver, _challenger, _executionId, disputes[_executionId].timeout);
    }
}
