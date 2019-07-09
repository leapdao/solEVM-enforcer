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
    let merkle;
    const stepper = new OffchainStepper();

    beforeEach(async () => {
      steps = await stepper.run({ code, data });
      copy = JSON.stringify(steps);
      merkle = new Merkelizer().run(steps, code, data);
    });

    it('both have the same result, solver wins', async () => {
      await callback(code, data, merkle, merkle, 'solver');
    });

    it('challenger has an output error somewhere', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution[6].compactStack.push('0x0000000000000000000000000000000000000000000000000000000000000001');
      wrongExecution[6].stack.push('0x0000000000000000000000000000000000000000000000000000000000000001');
      const challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, merkle, challengerMerkle, 'solver');
    });

    it('solver has an output error somewhere', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution[6].compactStack.push('0x0000000000000000000000000000000000000000000000000000000000000001');
      wrongExecution[6].stack.push('0x0000000000000000000000000000000000000000000000000000000000000001');
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('challenger first step missing', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution.shift();
      const challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, merkle, challengerMerkle, 'solver');
    });

    it('solver first step missing', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution.shift();
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('challenger last step gone', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution.pop();
      const challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, merkle, challengerMerkle, 'solver');
    });

    it('solver last step gone', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution.pop();
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('challenger wrong memory output', async () => {
      const wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].mem.push('0x0000000000000000000000000000000000000000000000000000000000000000');
      }
      const challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, merkle, challengerMerkle, 'solver');
    });

    it('solver wrong memory output', async () => {
      const wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].mem.push('0x0000000000000000000000000000000000000000000000000000000000000000');
      }
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('challenger wrong stack output', async () => {
      const wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].compactStack.push('0x0000000000000000000000000000000000000000000000000000000000000000');
        wrongExecution[i].stack.push('0x0000000000000000000000000000000000000000000000000000000000000000');
      }
      const challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, merkle, challengerMerkle, 'solver');
    });

    it('solver wrong stack output', async () => {
      const wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 2) {
        wrongExecution[i].compactStack.push('0x0000000000000000000000000000000000000000000000000000000000000000');
        wrongExecution[i].stack.push('0x0000000000000000000000000000000000000000000000000000000000000000');
      }
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('challenger wrong opcode', async () => {
      const wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 3) {
        wrongExecution[i].code = ['01'];
        wrongExecution[i].pc += 1;
      }
      const challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, merkle, challengerMerkle, 'solver');
    });

    it('solver wrong opcode', async () => {
      const wrongExecution = JSON.parse(copy);
      for (let i = 1; i < wrongExecution.length; i += 3) {
        wrongExecution[i].code = ['01'];
        wrongExecution[i].pc += 1;
      }
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('only two steps, both wrong but doesn\'t end with REVERT or RETURN = challenger wins', async () => {
      const wrongExecution = JSON.parse(copy).slice(0, 2);
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('solver misses steps in between', async () => {
      let wrongExecution = JSON.parse(copy);
      wrongExecution = wrongExecution.slice(0, 2).concat(wrongExecution.slice(-3));
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('solver with one invalid step', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution[7] = wrongExecution[8];
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('challenger with one invalid step', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution[7] = wrongExecution[8];
      const challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, merkle, challengerMerkle, 'solver');
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
    let merkle;
    const stepper = new OffchainStepper();

    before(async () => {
      steps = await stepper.run({ code });
      copy = JSON.stringify(steps);
      merkle = new Merkelizer().run(steps, code, data);
    });

    it('both have the same result, solver wins', async () => {
      await callback(code, data, merkle, merkle, 'solver');
    });

    it('solver last step gone', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution.pop();
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });
  });

  describe('solver messing with tree', function () {
    const code = [
      OP.PUSH1, '01',
      OP.PUSH1, '02',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.PUSH1, '03',
      OP.RETURN,
    ];

    const data = '0x';
    let steps;
    const stepper = new OffchainStepper();
    let challengerMerkle;
    let leaves;

    beforeEach(async () => {
      steps = await stepper.run({ code });
      challengerMerkle = new Merkelizer().run(steps, code, data);
      leaves = JSON.stringify(challengerMerkle.tree[0]);
    });

    it('copy last leaf to previous leaf #1', async () => {
      const solverMerkle = new Merkelizer();

      solverMerkle.tree[0] = JSON.parse(leaves);
      solverMerkle.tree[0][2] = solverMerkle.tree[0][3];
      solverMerkle.recal(0);
      debug('Solver', solverMerkle.printTree());
      debug('Challenger', challengerMerkle.printTree());
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('copy last leaf to previous leaf #2', async () => {
      const solverMerkle = new Merkelizer();

      solverMerkle.tree[0] = JSON.parse(leaves);
      solverMerkle.tree[0][1] = solverMerkle.tree[0][2];
      solverMerkle.recal(0);
      debug('Solver', solverMerkle.printTree());
      debug('Challenger', challengerMerkle.printTree());
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('copy last leaf to previous leaf #3', async () => {
      const solverMerkle = new Merkelizer();

      solverMerkle.tree[0] = JSON.parse(leaves);
      solverMerkle.tree[0][19] = solverMerkle.tree[0][20];
      solverMerkle.recal(0);
      debug('Solver', solverMerkle.printTree());
      debug('Challenger', challengerMerkle.printTree());
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('copy last leaf to previous leaf #4', async () => {
      const solverMerkle = new Merkelizer();

      solverMerkle.tree[0] = JSON.parse(leaves);
      solverMerkle.tree[0][18] = solverMerkle.tree[0][19];
      solverMerkle.recal(0);
      debug('Solver', solverMerkle.printTree());
      debug('Challenger', challengerMerkle.printTree());
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    it('challenger: copy last leaf to previous leaf #1', async () => {
      const challengerMerkle = new Merkelizer();
      const solverMerkle = new Merkelizer();

      solverMerkle.tree[0] = JSON.parse(leaves);
      solverMerkle.recal(0);

      challengerMerkle.tree[0] = JSON.parse(leaves);
      challengerMerkle.tree[0][18] = solverMerkle.tree[0][19];
      challengerMerkle.recal(0);
      debug('Solver', solverMerkle.printTree());
      debug('Challenger', challengerMerkle.printTree());
      await callback(code, data, solverMerkle, challengerMerkle, 'solver');
    });

    it('copy last leaf to previous leaf, change last leaf to zero', async () => {
      const solverMerkle = new Merkelizer();

      solverMerkle.tree[0] = JSON.parse(leaves);
      solverMerkle.tree[0][2] = solverMerkle.tree[0][3];
      solverMerkle.tree[0][3] = Merkelizer.zero();
      solverMerkle.recal(0);
      debug('Solver', solverMerkle.printTree());
      debug('Challenger', challengerMerkle.printTree());
      await callback(code, data, solverMerkle, challengerMerkle, 'challenger');
    });

    for (let i = 1; i < 23; i++) {
      it(`challenger fake tree[${i}]`, async () => {
        const solverMerkle = new Merkelizer().run(steps, code, data);
        const challengerMerkle = new Merkelizer().run(steps, code, data);

        challengerMerkle.tree[0][i] = challengerMerkle.tree[0][i + 1];
        challengerMerkle.recal(0);

        debug('Solver', solverMerkle.printTree());
        debug('Challenger', challengerMerkle.printTree());
        await callback(code, data, solverMerkle, challengerMerkle, 'solver');
      });
    }
  });

  describe('Fixture for Dispute/Verifier Logic #3', function () {
    const code = [
      OP.PUSH2, 'ffff',
      OP.PUSH1, '31',
      OP.MSTORE,
      OP.PUSH1, 'f0',
      OP.MLOAD,
      // TODO: this asserts(BN) in ethereumjs-vm
      // OP.PUSH4, 'ffffffff',
      // OP.PUSH2, 'ffff',
      // OP.PUSH3, 'ffffff',
      OP.PUSH1, 'ff',
      OP.PUSH1, '00',
      OP.PUSH1, '00',
      OP.CALLDATACOPY,
      OP.PUSH1, '20',
      OP.PUSH1, '00',
      OP.RETURN,
    ];
    const data = '0x00010203040506070809';

    let steps;
    let copy;
    let merkle;
    const stepper = new OffchainStepper();

    before(async () => {
      steps = await stepper.run({ code, data });
      copy = JSON.stringify(steps);
      merkle = new Merkelizer().run(steps, code, data);
    });

    it('both have the same result, solver wins', async () => {
      await callback(code, data, merkle, merkle, 'solver');
    });

    it('challenger wrong memory output #1', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution[2].mem.push('0x0000000000000000000000000000000000000000000000000000000000000000');
      const challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, merkle, challengerMerkle, 'solver');
    });

    it('solver wrong memory output #1', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution[2].mem.push('0x0000000000000000000000000000000000000000000000000000000000000000');
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('challenger wrong memory output #2', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution[4].mem.push('0x0000000000000000000000000000000000000000000000000000000000000000');
      const challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, merkle, challengerMerkle, 'solver');
    });

    it('solver wrong memory output #2', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution[4].mem.push('0x0000000000000000000000000000000000000000000000000000000000000000');
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('solver wrong memory output #3 - calldata', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution[8].mem.push('0x0000000000000000000000000000000000000000000000000000000000000000');
      const solverMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, solverMerkle, merkle, 'challenger');
    });

    it('challenger wrong execution tree', async () => {
      const wrongExecution = JSON.parse(copy);
      wrongExecution.push(wrongExecution[4]);
      wrongExecution.push(wrongExecution[5]);
      wrongExecution.push(wrongExecution[6]);
      wrongExecution.push(wrongExecution[7]);
      const challengerMerkle = new Merkelizer().run(wrongExecution, code, data);
      await callback(code, data, merkle, challengerMerkle, 'solver');
    });
  });

  describe('Fixture for Dispute/Verifier Logic #4', function () {
    this.timeout(55550);

    const code = [
      OP.PUSH3, 'a1a1a1',
      OP.PUSH3, 'ffffff',
      OP.MSTORE,
      OP.PUSH1, 'f0',
      OP.MLOAD,
      OP.PUSH1, '20',
      OP.PUSH1, '00',
      OP.RETURN,
    ];
    const data = '0x';

    let steps;
    let merkle;
    const stepper = new OffchainStepper();

    before(async () => {
      steps = await stepper.run({ code, data });
      merkle = new Merkelizer().run(steps, code, data);
    });

    it('both have the same result, solver looses because of overcommit on memory', async () => {
      await callback(code, data, merkle, merkle, 'challenger');
    });
  });
};
