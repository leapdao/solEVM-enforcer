module.exports = {
  testCommand: 'yarn mocha --timeout 120000 test/contracts/*.js',
  artifactsPath: 'build/contracts',
  proxyPort: 8333,
  rpcUrl: 'http://localhost:8222',
};
