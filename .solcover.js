module.exports = {
  compileCommand: '../node_modules/.bin/truffle compile',
  testCommand: '../node_modules/.bin/truffle test --network coverage test/contracts/*',
  norpc: true,
  deepSkip: true,
  // EVMRuntime to big for coverage as of now
  skipFiles: ['EVMRuntime.sol', 'mocks/'],
};
