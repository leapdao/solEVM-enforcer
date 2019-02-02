module.exports = {
  compileCommand: '../node_modules/.bin/truffle compile',
  testCommand: '../node_modules/.bin/truffle test --network coverage test/contracts/*',
  norpc: true,
  deepSkip: true,
  skipFiles: ['EthereumRuntime.sol', 'IEthereumRuntime.sol', 'CompactEthereumRuntime.sol', 'EVMRuntime.sol'],
};
