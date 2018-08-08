import { ADD, PUSH1 } from './helpers/constants';

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');

const toNum = arr => arr.map(e => e.toNumber());

contract('Runtime', function () {
  it('should allow to add', async function () {
    let rt = await EthereumRuntime.new();
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + ADD;
    const data = '0x';
    let rv = await rt.executeFlat(code, data);
    assert.equal(rv[2][0], 8);
  });

  describe('executeAndStop', () => {
    it('should allow to stop at specified op-count', async function () {
      let rt = await EthereumRuntime.new();
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + ADD;
      const data = '0x';
      let rv = await rt.executeAndStop(code, data, 2);
      assert.deepEqual(toNum(rv[2]), [3]);

      rv = await rt.executeAndStop(code, data, 4);
      assert.deepEqual(toNum(rv[2]), [3, 5]);

      rv = await rt.executeAndStop(code, data, 5);
      assert.deepEqual(toNum(rv[2]), [8]);
    });
  });

  describe('initAndExecute', () => {
    it('should allow to continue from a specified op-count', async function () {
      let rt = await EthereumRuntime.new();
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + ADD;
      const data = '0x';
      // execute steps 0 and 1 (PUSH 03) and stop.
      let rv = await rt.executeAndStop(code, data, 2);

      // continue execution from step 2 passing in stack (rv[2]) amd memory (rv[3])
      rv = await rt.initAndExecute(code, data, 2, rv[2], rv[3]);
      // we expect script to complete
      assert.deepEqual(toNum(rv[2]), [8]);

      rv = await rt.executeAndStop(code, data, 4);
      rv = await rt.initAndExecute(code, data, 4, rv[2], rv[3]);
      assert.deepEqual(toNum(rv[2]), [8]);

      rv = await rt.executeAndStop(code, data, 5);
      assert.deepEqual(toNum(rv[2]), [8]);
    });
  });
});
