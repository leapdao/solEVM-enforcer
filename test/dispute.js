
import Merkelizer from '../utils/Merkelizer';
import DisputeMock from '../utils/DisputeMock';
import OffchainStepper from '../utils/OffchainStepper';

// for additional logging
const DEBUG = false;
const OP = require('./helpers/constants');

function debugLog (...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

function submitProofHelper (dispute, code, computationPath) {
  const prevOutput = computationPath.left.executionState.output;
  const execState = computationPath.right.executionState;
  const input = execState.input;

  const proofs = {
    stackHash: Merkelizer.stackHash(
      prevOutput.stack.slice(0, prevOutput.stack.length - input.compactStack.length)
    ),
    memHash: execState.isMemoryRequired ? '' : Merkelizer.memHash(prevOutput.mem),
    dataHash: execState.isCallDataRequired ? '' : Merkelizer.dataHash(input.data),
  };

  return dispute.submitProof(
    proofs,
    {
      // TODO: compact {code,returnData}, support for accounts
      // code: input.code,
      code: code,
      data: execState.isCallDataRequired ? input.data : '',
      stack: input.compactStack,
      mem: execState.isMemoryRequired ? input.mem : '',
      returnData: input.returnData,
      pc: input.pc,
      logHash: input.logHash,
      gasRemaining: input.gasRemaining,
    }
  );
}

async function disputeGame (code, solverSteps, challengerSteps, expectedWinner, expectedError) {
  try {
    const stepper = OffchainStepper;
    const solverMerkle = new Merkelizer().run(solverSteps);
    const challengerMerkle = new Merkelizer().run(challengerSteps);

    if (DEBUG) {
      debugLog('solver depth=' + solverMerkle.depth);
      solverMerkle.printTree();
      debugLog('challenger depth=' + challengerMerkle.depth);
      challengerMerkle.printTree();
    }

    let solverComputationPath = solverMerkle.root;
    let challengerComputationPath = challengerMerkle.root;

    // TODO: handle the bigger case too
    if (solverMerkle.depth < challengerMerkle.depth) {
      challengerComputationPath = challengerMerkle.tree[solverMerkle.depth][0];
    }

    const dispute = new DisputeMock(
      solverComputationPath,
      challengerComputationPath,
      solverMerkle.depth,
      code,
      stepper
    );

    while (true) {
      if (solverComputationPath.isLeaf && challengerComputationPath.isLeaf) {
        debugLog('REACHED leaves');

        debugLog('Solver: SUBMITTING FOR l=' +
          solverComputationPath.left.hash + ' r=' + solverComputationPath.right.hash);
        await submitProofHelper(dispute, code, solverComputationPath);

        debugLog('Challenger: SUBMITTING FOR l=' +
          challengerComputationPath.left.hash + ' r=' + challengerComputationPath.right.hash);
        await submitProofHelper(dispute, code, challengerComputationPath);

        let winner = dispute.decideOutcome();
        debugLog('winner=' + winner);

        assert.equal(winner, expectedWinner, 'winner should match fixture');
        break;
      }

      if (!solverComputationPath.isLeaf) {
        let solverPath = dispute.solverPath;
        let nextPath = solverMerkle.getNode(solverPath);

        if (!nextPath) {
          debugLog('solver: submission already made by another party');
          solverComputationPath = solverMerkle.getPair(dispute.solver.left.hash, dispute.solver.right.hash);
          continue;
        }

        if (solverComputationPath.left.hash === solverPath) {
          debugLog('solver goes left from ' +
            solverComputationPath.hash.substring(2, 6) + ' to ' +
            solverComputationPath.left.hash.substring(2, 6)
          );
        } else if (solverComputationPath.right.hash === solverPath) {
          debugLog('solver goes right from ' +
            solverComputationPath.hash.substring(2, 6) + ' to ' +
            solverComputationPath.right.hash.substring(2, 6)
          );
        }

        solverComputationPath = nextPath;

        dispute.respond(solverComputationPath);
      }

      if (!challengerComputationPath.isLeaf) {
        let challengerPath = dispute.challengerPath;
        let nextPath = challengerMerkle.getNode(challengerPath);

        if (!nextPath) {
          debugLog('challenger submission already made by another party');
          challengerComputationPath =
            challengerMerkle.getPair(dispute.challenger.left.hash, dispute.challenger.right.hash);
          continue;
        }

        if (challengerComputationPath.left.hash === challengerPath) {
          debugLog('challenger goes left from ' +
            challengerComputationPath.hash.substring(2, 6) + ' to ' +
            challengerComputationPath.left.hash.substring(2, 6)
          );
        } else if (challengerComputationPath.right.hash === challengerPath) {
          debugLog('challenger goes right from ' +
            challengerComputationPath.hash.substring(2, 6) + ' to ' +
            challengerComputationPath.right.hash.substring(2, 6)
          );
        }

        challengerComputationPath = nextPath;

        dispute.respond(challengerComputationPath);
      }
    }
  } catch (e) {
    if (expectedError) {
      assert.equal(e.message, expectedError);
      return;
    }

    throw e;
  }
}

contract('JS DisputeMock', function () {
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
  const stepper = OffchainStepper;

  let steps;
  let copy;

  before(async () => {
    steps = await stepper.run({ code, data });
    copy = JSON.stringify(steps);
  });

  it('both have the same result, solver wins', async () => {
    await disputeGame(code, steps, steps, 'solver');
  });

  it('challenger has an output error somewhere', async () => {
    let wrongExecution = JSON.parse(copy);
    wrongExecution[6].output.compactStack.push('01');
    wrongExecution[6].output.stack.push('01');
    await disputeGame(code, steps, wrongExecution, 'solver');
  });

  it('solver has an output error somewhere', async () => {
    let wrongExecution = JSON.parse(copy);
    wrongExecution[6].output.compactStack.push('01');
    wrongExecution[6].output.stack.push('01');
    await disputeGame(code, wrongExecution, steps, 'challenger');
  });

  it('challenger first step missing', async () => {
    let wrongExecution = JSON.parse(copy);
    wrongExecution.shift();
    await disputeGame(code, steps, wrongExecution, 'solver');
  });

  it('solver first step missing', async () => {
    let wrongExecution = JSON.parse(copy);
    wrongExecution.shift();
    await disputeGame(code, wrongExecution, steps, 'challenger');
  });

  it('challenger last step gone', async () => {
    let wrongExecution = JSON.parse(copy);
    wrongExecution.pop();
    await disputeGame(code, steps, wrongExecution, 'solver');
  });

  it('solver last step gone', async () => {
    let wrongExecution = JSON.parse(copy);
    wrongExecution.pop();
    await disputeGame(code, wrongExecution, steps, 'challenger');
  });

  it('challenger wrong memory output', async () => {
    let wrongExecution = JSON.parse(copy);
    for (let i = 1; i < wrongExecution.length; i += 2) {
      wrongExecution[i].output.mem += '00';
    }
    await disputeGame(code, steps, wrongExecution, 'solver');
  });

  it('solver wrong memory output', async () => {
    let wrongExecution = JSON.parse(copy);
    for (let i = 1; i < wrongExecution.length; i += 2) {
      wrongExecution[i].output.mem += '00';
    }
    await disputeGame(code, wrongExecution, steps, 'challenger');
  });

  it('challenger wrong stack output', async () => {
    let wrongExecution = JSON.parse(copy);
    for (let i = 1; i < wrongExecution.length; i += 2) {
      wrongExecution[i].output.compactStack.push('00');
      wrongExecution[i].output.stack.push('00');
    }
    await disputeGame(code, steps, wrongExecution, 'solver');
  });

  it('solver wrong stack output', async () => {
    let wrongExecution = JSON.parse(copy);
    for (let i = 1; i < wrongExecution.length; i += 2) {
      wrongExecution[i].output.compactStack.push('00');
      wrongExecution[i].output.stack.push('00');
    }

    await disputeGame(code, wrongExecution, steps, 'challenger');
  });

  it('challenger wrong opcode', async () => {
    let wrongExecution = JSON.parse(copy);
    for (let i = 1; i < wrongExecution.length; i += 3) {
      wrongExecution[i].output.code = ['01'];
      wrongExecution[i].output.pc += 1;
    }
    await disputeGame(code, steps, wrongExecution, 'solver');
  });

  it('solver wrong opcode', async () => {
    let wrongExecution = JSON.parse(copy);
    for (let i = 1; i < wrongExecution.length; i += 3) {
      wrongExecution[i].output.code = ['01'];
      wrongExecution[i].output.pc += 1;
    }
    await disputeGame(code, wrongExecution, steps, 'challenger');
  });

  it('only two steps, both wrong but doesn\'t end with REVERT or RETURN = challenger wins', async () => {
    let wrongExecution = JSON.parse(copy).slice(0, 2);
    await disputeGame(code, wrongExecution, wrongExecution, 'challenger');
  });

  it('solver misses steps in between', async () => {
    let wrongExecution = JSON.parse(copy);
    wrongExecution = wrongExecution.slice(0, 2).concat(wrongExecution.slice(-3));
    await disputeGame(code, wrongExecution, steps, 'challenger');
  });

  it('solver with one invalid step', async () => {
    let wrongExecution = JSON.parse(copy);
    wrongExecution[7] = wrongExecution[8];
    await disputeGame(code, wrongExecution, steps, 'challenger');
  });

  it('challenger with one invalid step', async () => {
    let wrongExecution = JSON.parse(copy);
    wrongExecution[7] = wrongExecution[8];
    await disputeGame(code, steps, wrongExecution, 'solver');
  });
});
