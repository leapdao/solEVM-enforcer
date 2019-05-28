const OffchainStepper = require('./../../utils/OffchainStepper');
const Merkelizer = require('./../../utils/Merkelizer');
const OP = require('./../../utils/constants');
const debug = require('debug')('dispute-test');

module.exports = (callback) => {
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
    let solverMerkle;
    let challengerMerkle;
    const stepper = new OffchainStepper();

    beforeEach(async () => {
      steps = await stepper.run({ code, data });
      copy = JSON.stringify(steps);
      solverMerkle = new Merkelizer().run(steps, code, data);
      challengerMerkle = new Merkelizer().run(steps, code, data);
    });

    it('both have the same result, solver wins', async () => {
      await callback(code, data, solverMerkle, challengerMerkle, 'solver');
    });

    it('challenger has an output error somewhere', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution[6].compactStack.push('01');
      wrongExecution[6].stack.push('01');
      challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'solver');
    });

    it('solver has an output error somewhere', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution[6].compactStack.push('01');
      wrongExecution[6].stack.push('01');
      solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('challenger first step missing', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution.shift();
      challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'solver');
    });

    it('solver first step missing', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution.shift();
      solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('challenger last step gone', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution.pop();
      challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'solver');
    });

    it('solver last step gone', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution.pop();
      solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('challenger wrong memory output', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].mem += '00';
      }
      challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'solver');
    });

    it('solver wrong memory output', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].mem += '00';
      }
      solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('challenger wrong stack output', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].compactStack.push('00');
        wrongExecution[i].stack.push('00');
      }
      challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'solver');
    });

    it('solver wrong stack output', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].compactStack.push('00');
        wrongExecution[i].stack.push('00');
      }
      solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('challenger wrong opcode', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 3) {
        wrongExecution[i].code = ['01'];
        wrongExecution[i].pc += 1;
      }
      challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'solver');
    });

    it('solver wrong opcode', async () => {
      let wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 3) {
        wrongExecution[i].code = ['01'];
        wrongExecution[i].pc += 1;
      }
      solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('only two steps, both wrong but doesn\'t end with REVERT or RETURN = challenger wins', async () => {
      let wrongExecution = JSON.parse(copy).slice(0, 2);
      solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, solverMerkle, 'challenger');
    });

    it('solver misses steps in between', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution = wrongExecution.slice(0, 2).concat(wrongExecution.slice(-3));
      solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('solver with one invalid step', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution[7] = wrongExecution[8];
      solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('challenger with one invalid step', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution[7] = wrongExecution[8];
      challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'solver');
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
    const stepper = new OffchainStepper();
    let solverMerkle;
    let challengerMerkle;

    before(async () => {
      steps = await stepper.run({ code });
      copy = JSON.stringify(steps);
      solverMerkle = new Merkelizer().run(steps, code, data);
      challengerMerkle = new Merkelizer().run(steps, code, data);
    });

    it('both have the same result, solver wins', async () => {
      await callback(code, data, solverMerkle, challengerMerkle, 'solver');
    });

    it('solver last step gone', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution.pop();
      solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });
  });

  describe('solver messing with tree', function () {
    const code = [
      OP.PUSH1, '01',
      OP.PUSH1, '02',
      OP.PUSH1, '03',
      OP.RETURN,
    ];

    const data = '0x';
    let steps;
    const stepper = new OffchainStepper();
    let solverMerkle;
    let challengerMerkle;

    beforeEach(async () => {
      steps = await stepper.run({ code });
      solverMerkle = new Merkelizer().run(steps, code, data);
      challengerMerkle = new Merkelizer().run(steps, code, data);
    });

    it('copy last leaf to previous leaf', async () => {
      solverMerkle.tree[0][2] = solverMerkle.tree[0][3];
      solverMerkle.recal(0);
      debug('Solver', solverMerkle.printTree());
      debug('Challenger', challengerMerkle.printTree());
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('copy last leaf to previous leaf, change last leaf to zero', async () => {
      solverMerkle.tree[0][2] = solverMerkle.tree[0][3];
      solverMerkle.tree[0][3] = Merkelizer.zero();
      solverMerkle.recal(0);
      debug('Solver', solverMerkle.printTree());
      debug('Challenger', challengerMerkle.printTree());
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });
  });
};
