
import Merkelizer from './../../utils/Merkelizer';

import disputeFixtures from './../fixtures/dispute';
import { deployContract, txOverrides, deployCode } from './../helpers/utils';

const Verifier = artifacts.require('Verifier.sol');
const Enforcer = artifacts.require('Enforcer.sol');

// for additional logging
const DEBUG = false;

function debugLog (...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

async function submitProofHelper (verifier, disputeId, code, computationPath) {
  const prevOutput = computationPath.left.executionState.output;
  const execState = computationPath.right.executionState;
  const input = execState.input;
  const proofs = {
    stackHash: Merkelizer.stackHash(
      prevOutput.stack.slice(0, prevOutput.stack.length - input.compactStack.length)
    ),
    memHash: execState.isMemoryRequired ? ZERO_HASH : Merkelizer.memHash(prevOutput.mem),
    dataHash: execState.isCallDataRequired ? ZERO_HASH : Merkelizer.dataHash(input.data),
  };

  let tx = await verifier.submitProof(
    disputeId,
    proofs,
    {
      // TODO: compact {returnData}, support for accounts
      data: '0x' + (execState.isCallDataRequired ? input.data : ''),
      stack: input.compactStack,
      mem: '0x' + (execState.isMemoryRequired ? input.mem : ''),
      returnData: '0x' + input.returnData,
      logHash: '0x' + input.logHash,
      pc: input.pc,
      gasRemaining: input.gasRemaining,
    },
    txOverrides
  );

  tx = await tx.wait();

  /*
  tx.events.forEach(
    (ele) => {
      console.log(ele.args);
    }
  );
  */

  return tx;
}

async function disputeGame (
  enforcer, verifier, codeContract, code, callData, solverSteps, challengerSteps, expectedWinner, expectedError
) {
  try {
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

    const bondAmount = await enforcer.bondAmount();

    let tx = await enforcer.register(
      codeContract,
      callData,
      solverComputationPath.hash,
      solverSteps.length,
      { value: bondAmount, gasPrice: 0x01, gasLimit: 0xfffffffffffff }
    );

    tx = await tx.wait();
    tx = await enforcer.dispute(
      codeContract,
      callData,
      challengerComputationPath.hash,
      { value: bondAmount, gasPrice: 0x01, gasLimit: 0xfffffffffffff }
    );

    let dispute = await tx.wait();
    let event = dispute.events[0].args;

    while (true) {
      dispute = await verifier.disputes(event.disputeId);

      if (solverComputationPath.isLeaf && challengerComputationPath.isLeaf) {
        debugLog('REACHED leaves');

        debugLog('Solver: SUBMITTING FOR l=' +
          solverComputationPath.left.hash + ' r=' + solverComputationPath.right.hash);
        await submitProofHelper(verifier, event.disputeId, code, solverComputationPath);

        debugLog('Challenger: SUBMITTING FOR l=' +
          challengerComputationPath.left.hash + ' r=' + challengerComputationPath.right.hash);
        await submitProofHelper(verifier, event.disputeId, code, challengerComputationPath);

        // refresh again
        dispute = await verifier.disputes(event.disputeId);

        const SOLVER_VERIFIED = (1 << 2);
        let winner = 'challenger';
        if ((dispute.state & SOLVER_VERIFIED) !== 0) {
          winner = 'solver';
        }
        debugLog('winner=' + winner);

        assert.equal(winner, expectedWinner, 'winner should match fixture');
        break;
      }

      if (!solverComputationPath.isLeaf) {
        let solverPath = dispute.solverPath;
        let nextPath = solverMerkle.getNode(solverPath);

        if (!nextPath) {
          debugLog('solver: submission already made by another party');
          solverComputationPath = solverMerkle.getPair(dispute.solver.left, dispute.solver.right);
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

        tx = await verifier.respond(
          event.disputeId,
          {
            left: solverComputationPath.left.hash,
            right: solverComputationPath.right.hash,
          },
          txOverrides
        );
        await tx.wait();
        dispute = await verifier.disputes(event.disputeId);
      }

      if (!challengerComputationPath.isLeaf) {
        let challengerPath = dispute.challengerPath;
        let nextPath = challengerMerkle.getNode(challengerPath);

        if (!nextPath) {
          debugLog('challenger submission already made by another party');
          challengerComputationPath =
            challengerMerkle.getPair(dispute.challenger.left, dispute.challenger.right);
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

        tx = await verifier.respond(
          event.disputeId,
          {
            left: challengerComputationPath.left.hash,
            right: challengerComputationPath.right.hash,
          },
          txOverrides
        );
        await tx.wait();
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

contract('Verifier', function () {
  let enforcer;
  let verifier;

  before(async () => {
    const challengePeriod = 1000;
    const bondAmount = 1;

    verifier = await deployContract(Verifier, challengePeriod);
    enforcer = await deployContract(Enforcer, verifier.address, challengePeriod, bondAmount);

    let tx = await verifier.setEnforcer(enforcer.address);

    await tx.wait();
  });

  disputeFixtures(
    async (code, callData, solverSteps, challengerSteps, expectedWinner) => {
      const codeContract = await deployCode(code);

      await disputeGame(
        enforcer,
        verifier,
        codeContract.address,
        code,
        callData,
        solverSteps,
        challengerSteps,
        expectedWinner
      );
    }
  );
});
