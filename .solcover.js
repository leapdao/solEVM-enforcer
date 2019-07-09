module.exports = {
  compileCommand: '../node_modules/.bin/truffle compile',
  testCommand: 'COVERAGE=1 ../node_modules/.bin/mocha --timeout 120000 test/contracts/*',
  norpc: true,
  deepSkip: true,
  skipFiles: ['mocks/', 'PlasmaVerifier.sol'],
};
