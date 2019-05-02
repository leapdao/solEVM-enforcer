
const { getCode, toBN } = require('./../helpers/utils');
const OffchainStepper = require('./../../utils/OffchainStepper');
const fixtures = require('./../fixtures/runtime');

const assert = require('assert');

const fromHextoStr = arr => arr.map(e => toBN(e).toString());
const fromMixedToHex = arr => arr.map(e => toBN(e).toHexString('hex'));

describe('JS Stepper', function () {
  describe('fixtures', async () => {
    fixtures.forEach(fixture => {
      const { pc, opcodeUnderTest } = getCode(fixture);

      it(fixture.description || opcodeUnderTest, async () => {
        const stepper = new OffchainStepper();
        const code = typeof fixture.code === 'object' ? fixture.code : [fixture.code];
        const stack = fromMixedToHex(fixture.stack || []);
        const mem = fixture.memory || '';
        const data = fixture.data || '';
        const gasLimit = fixture.gasLimit;
        const blockGasLimit = fixture.gasLimit;
        const args = {
          code,
          data,
          stack,
          mem,
          gasLimit,
          blockGasLimit,
          pc,
        };
        const steps = await stepper.run(args);
        const res = steps[steps.length - 1];

        let gasUsed = 0;
        let len = steps.length;

        while (len--) {
          gasUsed += steps[len].gasFee;
        }

        if (fixture.result.stack) {
          assert.deepEqual(fromHextoStr(res.stack), fixture.result.stack, 'stack');
        }
        if (fixture.result.memory) {
          let padded = res.mem;

          while (padded.length % 64 !== 0) {
            padded += '00';
          }
          assert.equal(padded, fixture.result.memory.replace('0x', ''), 'mem');
        }
        if (fixture.result.gasUsed !== undefined) {
          assert.equal(gasUsed, fixture.result.gasUsed, 'gasUsed');
        }
        if (fixture.result.pc !== undefined) {
          assert.equal(res.pc, fixture.result.pc, 'pc');
        }
        if (fixture.result.errno !== undefined) {
          assert.equal(res.errno, fixture.result.errno, 'errno');
        }
      });
    });
  });
});
