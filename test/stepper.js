
import { getCode, toBN } from './utils';
import OffchainStepper from '../utils/OffchainStepper';
import fixtures from './fixtures';

const ethers = require('ethers');

const fromHextoStr = arr => arr.map(e => toBN(e).toString());
const fromMixedToHex = arr => arr.map(e => toBN(e).toHexString('hex'));

contract('JS Stepper', function () {
  describe('fixtures', async () => {
    fixtures.forEach(fixture => {
      const { pc, opcodeUnderTest } = getCode(fixture);

      it(fixture.description || opcodeUnderTest, async () => {
        const stepper = OffchainStepper;
        const code = typeof fixture.code === 'object' ? fixture.code : [fixture.code];
        const stack = fromMixedToHex(fixture.stack || []);
        const mem = fixture.memory || '';
        const accounts = fixture.accounts;
        const data = fixture.data || '';
        const gasLimit = fixture.gasLimit;
        const blockGasLimit = fixture.gasLimit;
        const logHash = fixture.logHash;
        const args = {
          code,
          data,
          stack,
          mem,
          accounts,
          logHash,
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
          assert.deepEqual(fromHextoStr(res.output.stack), fixture.result.stack, 'stack');
        }
        if (fixture.result.memory) {
          let padded = res.output.mem;

          while (padded.length % 64 !== 0) {
            padded += '00';
          }
          assert.equal(padded, fixture.result.memory.replace('0x', ''), 'mem');
        }
        if (fixture.result.gasUsed !== undefined) {
          assert.equal(gasUsed, fixture.result.gasUsed, 'gasUsed');
        }
        if (fixture.result.pc !== undefined) {
          assert.equal(res.output.pc, fixture.result.pc, 'pc');
        }
        if (fixture.result.errno !== undefined) {
          assert.equal(res.output.errno, fixture.result.errno, 'errno');
        }
        if (fixture.result.logHash) {
          assert.equal(res.output.logHash, fixture.result.logHash.replace('0x', ''), 'logHash');
        }
        if (fixture.result.accounts) {
          const accsMap = res.accounts.reduce((m, a) => { m[a.address] = a; return m; }, {});

          fixture.result.accounts.forEach(account => {
            const expectedAccount = accsMap[account.address.replace('0x', '')] || {};

            if (account.balance) {
              assert.equal(expectedAccount.balance, account.balance, 'Account Balance');
            }

            if (account.storage) {
              const stgeMap = account.storage.reduce(
                (m, a) => {
                  // ignore zero values
                  // eslint-disable-next-line eqeqeq
                  if (a.value == 0) {
                    return m;
                  }

                  m[ethers.utils.solidityKeccak256(['uint'], [a.address]).replace('0x', '')] =
                    toBN(a.value).toHexString().replace('0x', '');
                  return m;
                },
                {}
              );

              assert.deepEqual(expectedAccount.storage, stgeMap, 'Account Storage');
            }
          });
        }
      });
    });
  });
});
