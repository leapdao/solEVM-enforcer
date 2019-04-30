
const Merkelizer = require('./../../utils/Merkelizer');
const DisputeMock = require('./../../utils/DisputeMock');
const OffchainStepper = require('./../../utils/OffchainStepper');
const disputeFixtures = require('./../fixtures/dispute');

const assert = require('assert');
// for additional logging
const DEBUG = false;

function debugLog (...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

function submitProofHelper (dispute, code, computationPath) {
  const prevOutput = computationPath.left.executionState;
  const execState = computationPath.right.executionState;

  const proofs = {
    stackHash: Merkelizer.stackHash(
      prevOutput.stack.slice(0, prevOutput.stack.length - execState.compactStack.length)
    ),
    memHash: execState.isMemoryRequired ? '' : Merkelizer.memHash(prevOutput.mem),
    dataHash: execState.isCallDataRequired ? '' : Merkelizer.dataHash(prevOutput.data),
  };

  return dispute.submitProof(
    proofs,
    {
      // TODO: compact returnData
      data: execState.isCallDataRequired ? prevOutput.data : '',
      stack: execState.compactStack,
      mem: execState.isMemoryRequired ? prevOutput.mem : '',
      returnData: prevOutput.returnData,
      logHash: prevOutput.logHash,
      pc: prevOutput.pc,
      gasRemaining: prevOutput.gasRemaining,
    }
  );
}

async function disputeGame (code, callData, solverSteps, challengerSteps, expectedWinner, expectedError) {
  try {
    const stepper = new OffchainStepper();
    const solverMerkle = new Merkelizer().run(solverSteps, code, callData);
    const challengerMerkle = new Merkelizer().run(challengerSteps, code, callData);

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
      callData,
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

describe('JS DisputeMock', function () {
  disputeFixtures(
    async (code, callData, solverSteps, challengerSteps, expectedWinner) => {
      await disputeGame(code, callData, solverSteps, challengerSteps, expectedWinner);
    }
  );
});
