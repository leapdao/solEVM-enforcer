import { ADD, PUSH1 } from './helpers/constants';

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');

const toNum = arr => arr.map(e => e.toNumber());

contract('Runtime', function () {
  it('should allow to add', async function () {
    let rt = await EthereumRuntime.new();
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + ADD;
    const data = '0x';
    let rv = await rt.executeFlat(code, data);
    assert.equal(rv[3][0], 8);
  });

  describe('executeAndStop', () => {
    it('should allow to stop at specified op-count', async function () {
      let rt = await EthereumRuntime.new();
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + ADD;
      const data = '0x';
      let rvcall = await rt.callEmpty();
      console.log('call: ', rvcall[0], rvcall[0]);
      // let rv = await rt.executeAndStop(code, data, 2);
      // assert.deepEqual(toNum(rv[3]), [3]);

      // rv = await rt.executeAndStop(code, data, 4);
      // assert.deepEqual(toNum(rv[3]), [3, 5]);

      // rv = await rt.executeAndStop(code, data, 5);
      // assert.deepEqual(toNum(rv[3]), [8]);
    });
  });
});
