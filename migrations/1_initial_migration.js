var Migrations = artifacts.require('Migrations');

module.exports = (deployer) => {
  // Deploy the Migrations contract as our only task
  deployer.deploy(Migrations);
};