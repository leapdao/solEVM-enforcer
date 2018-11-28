
import Merkelizer from './Merkelizer';

export default class DisputeMock {
  constructor (solverComputationPath, challengerComputationPath, solverDepth, code, evm) {
    this.treeDepth = solverDepth;

    this.solver = solverComputationPath;
    this.challenger = challengerComputationPath;

    this.solverDidRespond = false;
    this.challengerDidRespond = false;

    this.solverVerified = false;
    this.challengerVerified = false;

    this.isEndOfExecution = true;
    this.codeHash = Merkelizer.codeHash(code);
    this.evm = evm;

    this._updateRound();
  }

  _updateRound () {
    this.solverDidRespond = false;
    this.challengerDidRespond = false;

    const EMPTY_STATE = '0x0000000000000000000000000000000000000000000000000000000000000000';

    if ((this.solver.left.hash === this.challenger.left.hash) &&
      (this.solver.right.hash !== EMPTY_STATE) &&
      (this.challenger.right.hash !== EMPTY_STATE)) {
      // following right
      this.solverPath = this.solver.right.hash;
      this.challengerPath = this.challenger.right.hash;

      if (this.isEndOfExecution) {
        this.isEndOfExecution = true;
      }
    } else {
      // following left
      this.solverPath = this.solver.left.hash;
      this.challengerPath = this.challenger.left.hash;

      if (this.solver.right.hash !== EMPTY_STATE) {
        this.isEndOfExecution = false;
      }
    }
  }

  /*
   * Solver or Challenger always respond with the next `ComputationPath`
   * for the path they do not agree on.
   * If they do not agree on both `left` and `right` they must follow/default
   * to `left`.
   */
  respond (computationPath) {
    let h = Merkelizer.hash(computationPath.left.hash, computationPath.right.hash);

    if (h !== this.solverPath && h !== this.challengerPath) {
      throw new Error(
        `wrong path submitted need ${this.solverPath} or ${this.challengerPath} has ${h}`
      );
    }

    if ((h === this.solver.left.hash) || (h === this.solver.right.hash)) {
      if (this.solverDidRespond) {
        throw new Error('You can not respond right now');
      }

      this.solverDidRespond = true;
      this.solver = computationPath;
    }

    if ((h === this.challenger.left.hash) || (h === this.challenger.right.hash)) {
      if (this.challengerDidRespond) {
        throw new Error('You can not respond right now');
      }

      this.challengerDidRespond = true;
      this.challenger = computationPath;
    }

    if (this.solverDidRespond && this.challengerDidRespond) {
      this._updateRound();
    }
  }

  async computeExecutionState (executionState) {
    const args = {
      code: executionState.code,
      data: executionState.data,
      stack: executionState.stack,
      mem: executionState.mem,
      pc: executionState.isCodeCompacted ? 0 : executionState.pc,
      logHash: executionState.logHash,
      gasRemaining: executionState.gasRemaining,
    };

    // should only be one step for the time being..
    const steps = await this.evm.run(args);
    const r = steps[0] ||
      {
        output: {
          data: '',
          compactStack: [],
          stack: [],
          mem: '',
          returnData: '',
          pc: 0,
          errno: 0xff,
          logHash: '',
          gasRemaining: 0,
        },
      };

    return r;
  }

  /*
   * if they agree on `left` but not on `right`,
   * submitProof (on-chain) verification should be called by challenger and solver
   * to later decide on the outcome in `decideOutcome`
   *
   * Requirements:
   *  - last execution step must end with either REVERT or RETURN to be considered complete
   *  - any execution step which does not have errno = 0 or errno = 0x07 (REVERT)
   *    is considered invalid
   *  - the left-most (first) execution step must be a `Merkelizer.emptyState`
   *    TODO: This must be accounted for in a `timeout` function.
   *
   * Note: if that doesn't happen, this will finally timeout
   */
  async submitProof (proofs, executionInput) {
    if (this.solverPath === this.challengerPath) {
      // special case
    } else if (this.solver.left.hash !== this.challenger.left.hash) {
      throw new Error('solver.left must match challenger.left');
    }

    if (Merkelizer.codeHash(executionInput.code) !== this.codeHash) {
      throw new Error('codeHash does not match');
    }

    let stackHash = Merkelizer.stackHash(executionInput.stack, proofs.stackHash);
    let inputHash = Merkelizer.stateHash(executionInput, stackHash, proofs.memHash, proofs.dataHash);

    if (inputHash !== this.solver.left.hash && inputHash !== this.challenger.left.hash) {
      return 'invalid';
    }

    let result = await this.computeExecutionState(executionInput);
    stackHash = Merkelizer.stackHash(result.output.stack, proofs.stackHash);
    let hash = Merkelizer.stateHash(result.output, stackHash, proofs.memHash, proofs.dataHash);

    // eslint-disable-next-line no-constant-condition
    if (0) {
      console.log(
        {
          'solver': this.solver,
          'solverPath': this.solverPath,
          'challenger': this.challenger,
          'challengerPath': this.challengerPath,
          'isEndOfExecution': this.isEndOfExecution,
          'hash': hash,
        }
      );
    }

    if (hash !== this.solver.right.hash && hash !== this.challenger.right.hash) {
      return 'invalid';
    }

    if (hash === this.solver.right.hash) {
      this.solverVerified = true;

      if (!this.result && result.output.errno !== 0 && result.output.errno !== 0x07) {
        this.result = 'challenger';
      }

      if (this.isEndOfExecution) {
        if (result.opcodeName !== 'REVERT' && result.opcodeName !== 'RETURN') {
          this.result = 'challenger';
        }
      }
    }

    if (hash === this.challenger.right.hash) {
      this.challengerVerified = true;

      if (!this.result && result.output.errno !== 0 && result.output.errno !== 0x07) {
        this.result = 'solver';
      }

      if (!this.result && this.isEndOfExecution) {
        if (result.opcodeName !== 'REVERT' && result.opcodeName !== 'RETURN') {
          this.result = 'solver';
        }
      }
    }
  }

  decideOutcome () {
    if (this.result) {
      return this.result;
    }

    if (this.solverVerified) {
      return 'solver';
    }

    if (this.challengerVerified) {
      return 'challenger';
    }

    return 'none';
  }
}
