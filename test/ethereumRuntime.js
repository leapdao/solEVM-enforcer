import { ADD, PUSH1 } from './helpers/constants';

const EthereumRuntime = artifacts.require('EthereumRuntime');
const EVMAccounts = artifacts.require('EVMAccounts');
const EVMStorage = artifacts.require('EVMStorage');
const EVMMemory = artifacts.require('EVMMemory');
const EVMStack = artifacts.require('EVMStack');
const EVMLogs = artifacts.require('EVMLogs');

const deployRuntime = async () => {
  return Promise.all([
    EVMMemory.new(),
    EVMStorage.new(),
    EVMStack.new(),
    EVMLogs.new()
  ]).then(async ([evmMemory, evmStorage, evmStack, evmLogs]) => {
    EVMAccounts.link('EVMStorage', evmStorage.address);
    const evmAccounts = await EVMAccounts.new();
    EthereumRuntime.link('EVMAccounts', evmAccounts.address);
    EthereumRuntime.link('EVMStorage', evmStorage.address);
    EthereumRuntime.link('EVMMemory', evmMemory.address);
    EthereumRuntime.link('EVMStack', evmStack.address);
    EthereumRuntime.link('EVMLogs', evmLogs.address);
    return EthereumRuntime.new();
  });
};

contract('Runtime', function () {
  it('should allow to add', async function () {
    let rt = await deployRuntime();
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + ADD;
    const data = '0x';
    let rv = await rt.executeFlat(code, data);
    assert.equal(rv[3][0], 8);
  });
});
