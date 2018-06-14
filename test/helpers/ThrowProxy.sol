// Proxy contract for testing throws
contract ThrowProxy {
  address public target;
  bytes data;

  constructor(address _target) {
    target = _target;
  }

  //prime the data using the fallback function.
  function() public {
    data = msg.data;
  }

  function execute() public returns (bool) {
    return target.call(data);
  }
}