'use strict';

const { getCode } = require('./../helpers/utils');
const { Constants, HydratedRuntime } = require('./../../utils/');
const fixtures = require('./../fixtures/runtime');

const assert = require('assert');

describe('JS Stepper', function () {
  describe('fixtures', async () => {
    fixtures.forEach(fixture => {
      const { pc, opcodeUnderTest } = getCode(fixture);

      it(fixture.description || opcodeUnderTest, async () => {
        const stepper = new HydratedRuntime();
        const code = typeof fixture.code === 'object' ? fixture.code : [fixture.code];
        const stack = fixture.stack || [];
        const mem = fixture.memory || '';
        const data = fixture.data || '';
        const gasLimit = fixture.gasLimit || Constants.BLOCK_GAS_LIMIT;
        const blockGasLimit = fixture.gasLimit || Constants.BLOCK_GAS_LIMIT;
        const gasRemaining = typeof fixture.gasRemaining !== 'undefined' ? fixture.gasRemaining : gasLimit;
        const args = {
          code,
          data,
          stack,
          mem,
          gasLimit,
          blockGasLimit,
          gasRemaining,
          pc,
        };
        const steps = await stepper.run(args);
        const res = steps[steps.length - 1];

        if (fixture.result.stack) {
          assert.deepEqual(res.stack, fixture.result.stack, 'stack');
        }
        if (fixture.result.memory) {
          assert.deepEqual(res.mem, fixture.result.memory, 'mem');
        }
        if (fixture.result.gasUsed !== undefined) {
          assert.equal(gasRemaining - res.gasRemaining, fixture.result.gasUsed, 'gasUsed');
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
