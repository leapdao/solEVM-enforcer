pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import "./ICallback.sol";
import "./IVerifier.sol";


contract Enforcer {

    uint256 public challengePeriod;
    uint256 public bondAmount;
    IVerifier public verifier;

    struct Execution {
        uint256 startBlock;
        bytes32 endHash;
        uint256 step;
        address solver;
    }

    mapping(bytes32 => Execution) public executions;
    mapping(address => uint256) public bonds;

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyVerifier() {
        require(msg.sender == address(verifier));
        _;
    }

    event Registered(bytes32 indexed _executionId, address indexed _solver, bytes _code, bytes _callData);
    event Slashed(bytes32 indexed _executionId, address indexed _address);

    constructor(address _verifier, uint256 _challengePeriod, uint256 _bondAmount) public {
        verifier = IVerifier(_verifier);
        challengePeriod = _challengePeriod;
        bondAmount = _bondAmount;
    }

    // register a new execution
    function register(bytes memory _code, bytes memory _callData, bytes32 _endHash, uint256 _step)
        public payable returns(bytes32 executionId)
    {
        require(msg.value == bondAmount);
        executionId = keccak256(abi.encodePacked(_code, _callData));
        require(executions[executionId].startBlock == 0);
        executions[executionId] = Execution(block.number, _endHash, _step, msg.sender);
        bonds[msg.sender] += bondAmount;
        emit Registered(executionId, msg.sender, _code, _callData);
    }

    // starts a new dispute
    function dispute(bytes32 _executionId, bytes32 _endHash, uint256 _step) public payable {
        Execution storage execution = executions[_executionId];
        require(execution.startBlock != 0);
        require(execution.startBlock + challengePeriod > block.number);
        require(msg.value == bondAmount);
        require(execution.endHash != _endHash || execution.step != _step);
        bonds[msg.sender] += bondAmount;
        verifier.initGame(_executionId, execution.endHash, execution.step, _endHash, _step, msg.sender);
    }

    // receive result from Verifier contract
    function result(bytes32 _executionId, bool _result, address _challenger) public onlyVerifier() {
        require(executions[_executionId].startBlock != 0);
        require(executions[_executionId].startBlock + challengePeriod > block.number);
        if (_result == true) {
            // slash deposit of challenger
            bonds[_challenger] -= bondAmount;
            emit Slashed(_executionId, _challenger);
        } else {
            // slash deposit of solver
            bonds[executions[_executionId].solver] -= bondAmount;
            emit Slashed(_executionId, executions[_executionId].solver);
            // delete execution
            delete executions[_executionId];
        }
        bool success = address(0).send(bondAmount);
        require(success == true);
    }

    // tell Solver that execution passed
    function finalize(bytes32 _executionId) public {
        // check execution exists
        require(executions[_executionId].startBlock != 0);
        // check that dispute period is over
        require(block.number >= executions[_executionId].startBlock + challengePeriod);
        ICallback(executions[_executionId].solver).finalize.value(bondAmount)(_executionId);
    }

}
