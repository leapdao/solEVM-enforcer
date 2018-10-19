pragma solidity ^0.4.24;

import "./ICallback.sol";
import "./IVerifier.sol";

contract Enforcer {

  uint256 challengePeriod;
  uint256 bondAmount;
  IVerifier verifier;

  struct Execution {
    uint256 startBlock;
    bytes32 endHash;
    address solver;
  }

  mapping(bytes32 => Execution) public executions;
  mapping(address => uint256) bonds;

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyVerifier() {
    require(msg.sender == address(verifier));
    _;
  }

  event Register(bytes32 indexed _executionId, address indexed _solver, bytes _code, bytes _callData);
  event Slash(bytes32 indexed _executionId, address indexed _address);

  constructor(address _verifier, uint256 _challengePeriod, uint256 _bondAmount) public {
    verifier = IVerifier(_verifier);
    challengePeriod = _challengePeriod;
    bondAmount = _bondAmount;
  }

  // register a new execution 
  function register(bytes _code, bytes _callData, bytes32 _endHash) payable public returns(bytes32 executionId) {
    require(msg.value == bondAmount);
    executionId = keccak256(abi.encodePacked(_code, _callData));
    require(executions[executionId].startBlock == 0);
    executions[executionId] = Execution(block.number, _endHash, msg.sender);
    bonds[msg.sender] += bondAmount;
    emit Register(executionId, msg.sender, _code, _callData);
  }

  // starts a new dispute
  function dispute(bytes32 _executionId, bytes32 _endHash) payable public {
    require(executions[_executionId].startBlock != 0);
    require(executions[_executionId].startBlock + challengePeriod > block.number);
    require(msg.value == bondAmount);
    require(executions[_executionId].endHash != _endHash);
    bonds[msg.sender] += bondAmount;
    verifier.initGame(_executionId, _endHash, executions[_executionId].solver, msg.sender);
  }

  // receive result from Verifier contract
  function result(bytes32 _executionId, bool _result, address _challenger) onlyVerifier() public {
    require(executions[_executionId].startBlock != 0);
    require(executions[_executionId].startBlock + challengePeriod > block.number);
    if (_result == true) {
      // slash deposit of challenger
      bonds[_challenger] -= bondAmount;
      emit Slash(_executionId, _challenger);
    } else {
      // slash deposit of solver
      bonds[executions[_executionId].solver] -= bondAmount;
      emit Slash(_executionId, executions[_executionId].solver);
      // delete execution
      delete executions[_executionId];
    }
    address(0).send(bondAmount);
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
