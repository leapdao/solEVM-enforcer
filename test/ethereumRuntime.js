import { ADD, PUSH1 } from './helpers/constants';

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');

contract('Runtime', function () {
  it('should allow to add', async function () {
    let rt = await EthereumRuntime.new();
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + ADD;
    const data = '0x';
    let rv = await rt.executeFlat(code, data);
    assert.equal(rv[3][0], 8);
  });
});
