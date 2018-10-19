pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../IVerifier.sol";
import "../IEnforcer.sol";

contract VerifierMock is Ownable, IVerifier {

  uint256 queryPeriod;
  IEnforcer enforcer;

  struct Dispute {
    uint256 lastQueryBlock;
    address solver;
    address challenger;
    bytes32 executionId;
  }

  mapping(bytes32 => Dispute) disputes;

  event DisputeStart(bytes32 indexed _disputeId);

  constructor(uint256 _queryPeriod) public {
    owner = msg.sender;
    queryPeriod = _queryPeriod;
  }

  function setEnforcer(address _enforcer) onlyOwner() public {
    enforcer = IEnforcer(_enforcer);
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyEnforcer() {
    require(msg.sender == address(enforcer));
    _;
  }

  function initGame(bytes32 _executionId, bytes32 _endHash, address _solver, address _challenger) onlyEnforcer() public {
    bytes32 disputeId = keccak256(abi.encodePacked(_executionId, _solver, _challenger));
    require(disputes[disputeId].lastQueryBlock == 0);
    emit DisputeStart(disputeId);
    disputes[disputeId] = Dispute(block.number, _solver, _challenger, _executionId);
  }

  function result(bytes32 _disputeId, bool _winner) public {
    require(disputes[_disputeId].lastQueryBlock > 0);
    enforcer.result(disputes[_disputeId].executionId, _winner, disputes[_disputeId].challenger);
  }

}
