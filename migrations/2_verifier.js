
const Verifier = artifacts.require('Verifier');

module.exports = (deployer) => {
  deployer.deploy(Verifier, 100);
};
