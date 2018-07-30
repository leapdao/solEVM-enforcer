const EthereumRuntime = artifacts.require('EthereumRuntime');
const EVMAccounts = artifacts.require('EVMAccounts');
const EVMStorage = artifacts.require('EVMStorage');
const EVMMemory = artifacts.require('EVMMemory');
const EVMStack = artifacts.require('EVMStack');
const EVMLogs = artifacts.require('EVMLogs');

module.exports = async (deployer, network) => {
  return;
  console.log(`Deploying to ${network}`);
  await deployer.deploy(EVMMemory);
  await deployer.deploy(EVMLogs);
  await deployer.deploy(EVMStack);
  await deployer.deploy(EVMStorage);
  await deployer.link(EVMStorage, [EVMAccounts, EthereumRuntime]);
  await deployer.deploy(EVMAccounts);
  await deployer.link(EVMAccounts, EthereumRuntime);
  await deployer.link(EVMMemory, EthereumRuntime);
  await deployer.link(EVMLogs, EthereumRuntime);
  await deployer.link(EVMStack, EthereumRuntime);
  await deployer.deploy(EthereumRuntime);
};
