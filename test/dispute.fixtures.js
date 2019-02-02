
import OffchainStepper from '../utils/OffchainStepper';

const OP = require('./../utils/constants');

export default (callback) => {
  describe('Fixture for Dispute/Verifier Logic #1', function () {
    const code = [
      OP.PUSH1, '03',
      OP.PUSH1, '05',
      OP.ADD,
      OP.PUSH1, 'ff',
      OP.PUSH1, '00',
      OP.MSTORE,
      OP.PUSH1, '00',
      OP.MLOAD,
      OP.PUSH1, '00',
      OP.MSTORE,
      OP.PUSH1, 'ff',
      OP.POP,
      OP.PUSH1, '00',
      OP.PUSH1, '01',
      OP.DUP1,
      OP.SWAP1,
      OP.CALLDATASIZE,
      OP.CALLDATACOPY,
      OP.GASLIMIT,
      OP.PUSH1, '01',
      OP.MSTORE,
      OP.PUSH1, '00',
      OP.PUSH1, '01',
      OP.LOG0,
      OP.PUSH1, '00',
      OP.PUSH1, '01',
      OP.SHA3,
      OP.PUSH1, '20',
      OP.PUSH1, '00',
      OP.RETURN,
    ];
    const data = '0x00010203040506070809';

    let steps;
    let copy;

    before(async () => {
      steps = await OffchainStepper.run({ code, data });
      copy = JSON.stringify(steps);
    });

    it('both have the same result, solver wins', async () => {
      await callback(code, data, steps, steps, 'solver');
    });

    it('challenger has an output error somewhere', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution[6].output.compactStack.push('01');
      wrongExecution[6].output.stack.push('01');
      await callback(code, data, steps, wrongExecution, 'solver');
    });

    it('solver has an output error somewhere', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution[6].output.compactStack.push('01');
      wrongExecution[6].output.stack.push('01');
      await callback(code, data, wrongExecution, steps, 'challenger');
    });

    it('challenger first step missing', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution.shift();
      await callback(code, data, steps, wrongExecution, 'solver');
    });

    it('solver first step missing', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution.shift();
      await callback(code, data, wrongExecution, steps, 'challenger');
    });

    it('challenger last step gone', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution.pop();
      await callback(code, data, steps, wrongExecution, 'solver');
    });

    it('solver last step gone', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution.pop();
      await callback(code, data, wrongExecution, steps, 'challenger');
    });

    it('challenger wrong memory output', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].output.mem += '00';
      }
      await callback(code, data, steps, wrongExecution, 'solver');
    });

    it('solver wrong memory output', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].output.mem += '00';
      }
      await callback(code, data, wrongExecution, steps, 'challenger');
    });

    it('challenger wrong stack output', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].output.compactStack.push('00');
        wrongExecution[i].output.stack.push('00');
      }
      await callback(code, data, steps, wrongExecution, 'solver');
    });

    it('solver wrong stack output', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].output.compactStack.push('00');
        wrongExecution[i].output.stack.push('00');
      }

      await callback(code, data, wrongExecution, steps, 'challenger');
    });

    it('challenger wrong opcode', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 3) {
        wrongExecution[i].output.code = ['01'];
        wrongExecution[i].output.pc += 1;
      }
      await callback(code, data, steps, wrongExecution, 'solver');
    });

    it('solver wrong opcode', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 3) {
        wrongExecution[i].output.code = ['01'];
        wrongExecution[i].output.pc += 1;
      }
      await callback(code, data, wrongExecution, steps, 'challenger');
    });

    it('only two steps, both wrong but doesn\'t end with REVERT or RETURN = challenger wins', async () => {
      let wrongExecution = JSON.parse(copy).slice(0, 2);
      await callback(code, data, wrongExecution, wrongExecution, 'challenger');
    });

    it('solver misses steps in between', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution = wrongExecution.slice(0, 2).concat(wrongExecution.slice(-3));
      await callback(code, data, wrongExecution, steps, 'challenger');
    });

    it('solver with one invalid step', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution[7] = wrongExecution[8];
      await callback(code, data, wrongExecution, steps, 'challenger');
    });

    it('challenger with one invalid step', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution[7] = wrongExecution[8];
      await callback(code, data, steps, wrongExecution, 'solver');
    });
  });

  describe('Fixture for Dispute/Verifier Logic #2 (JUMP)', function () {
    const code = [
      OP.PUSH1, '08', OP.JUMP, // jump to 0x08
      OP.JUMPDEST, OP.GASLIMIT, OP.PUSH1, '0C', OP.JUMP, // 0x03. Jump to 0x0c
      OP.JUMPDEST, OP.PUSH1, '03', OP.JUMP, // 0x08. Jump to 0x03
      OP.JUMPDEST, // 0x0c
      OP.PUSH1, '00',
      OP.DUP1,
      OP.REVERT,
    ];
    const data = '0x';
    let steps;
    let copy;

    before(async () => {
      steps = await OffchainStepper.run({ code });
      copy = JSON.stringify(steps);
    });

    it('both have the same result, solver wins', async () => {
      await callback(code, data, steps, steps, 'solver');
    });

    it('solver last step gone', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution.pop();
      await callback(code, data, wrongExecution, steps, 'challenger');
    });
  });
};
