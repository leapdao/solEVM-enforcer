pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../IVerifier.sol";
import "../IEnforcer.sol";
import "../IEthereumRuntime.sol";

contract VerifierMock is Ownable, IVerifier {

  uint256 queryPeriod;
  IEnforcer enforcer;
  IEthereumRuntime ethereumRuntime;

  struct Dispute {
    uint256 lastQueryBlock;
    address challenger;
    bytes32 executionId;
  }

  mapping(bytes32 => Dispute) disputes;

  event DisputeStart(bytes32 indexed _disputeId);

  constructor(uint256 _queryPeriod) public {
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

  function initGame(bytes32 _executionId, bytes32 _endHash, uint256 _solverStep, bytes32 _challengerEndHash, uint256 _challengerStep, address _challenger) onlyEnforcer() public {
    bytes32 disputeId = keccak256(abi.encodePacked(_executionId, _challenger));
    require(disputes[disputeId].lastQueryBlock == 0);
    emit DisputeStart(disputeId);
    disputes[disputeId] = Dispute(block.number, _challenger, _executionId);
  }

  function result(bytes32 _disputeId, bool _winner) public {
    require(disputes[_disputeId].lastQueryBlock > 0);
    enforcer.result(disputes[_disputeId].executionId, _winner, disputes[_disputeId].challenger);
  }

  function runStep(bytes32 _disputeId, IEthereumRuntime.Result memory) public {
  }
}
