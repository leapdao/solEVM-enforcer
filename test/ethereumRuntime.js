import fixtures from './fixtures';

const OP = require('./helpers/constants');
const { PUSH1 } = OP;

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');

const opcodes = Object.keys(OP).reduce((s, k) => { s[OP[k]] = k; return s; }, {});

const toNum = arr => arr.map(e => e.toNumber());

contract('Runtime', function () {
  let rt;
  
  before(async () => {
    rt = await EthereumRuntime.new();
  });

  it('should allow to add', async function () {
    const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
    const data = '0x';
    let rv = await rt.executeFlat(code, data);
    assert.equal(rv[2][0], 8);
  });

  describe('executeAndStop', () => {
    it('should allow to stop at specified op-count', async function () {
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
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
    it('can continue from non-zero program counter', async () => {
      const code = '0x' + PUSH1 + '03' + PUSH1 + '05' + OP.ADD;
      let [,, stack, memory] = await rt.executeAndStop(code, '0x', 4);
      [,, stack, memory] = await rt.initAndExecute(code, '0x', 4, stack, memory);
      assert.deepEqual(toNum(stack), [8]);
    });

    fixtures.forEach(fixture => {
      it(opcodes[fixture.opcode], async () => {
        const code = `0x${fixture.opcode}`;
        const [,, stack] = await rt.initAndExecute(code, '0x', 0, fixture.stack, '0x');
        if (fixture.result.stack) {
          assert.deepEqual(toNum(stack), fixture.result.stack);
        }
      });
    });
  });
});
