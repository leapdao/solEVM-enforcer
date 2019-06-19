const OffchainStepper = require('./OffchainStepper.js');
const Merkelizer = require('./Merkelizer.js');
const ProofHelper = require('./ProofHelper.js');
const { ZERO_HASH } = require('./constants.js');

module.exports = class ExecutionPoker {
  constructor (enforcer, verifier, wallet, gasLimit, logTag) {
    this.enforcer = enforcer.connect(wallet);
    this.verifier = verifier.connect(wallet);
    this.wallet = wallet;
    this.gasLimit = gasLimit || 0xfffffffffffff;
    this.logTag = logTag || 'unkn';
    this.executionParams = {};
    this.disputes = {};
    this.solutions = {};

    this.enforcer.on(
      this.enforcer.filters.Request(),
      async (executionId, parameters, tx) => {
        const params = {
          origin: parameters[0],
          target: parameters[1],
          blockHash: parameters[2],
          blockNumber: parameters[3],
          time: parameters[4],
          txGasLimit: parameters[5],
          customEnvironmentHash: parameters[6],
          codeHash: parameters[7],
          dataHash: parameters[8],
        };
        this.executionParams[executionId] = params;

        const receipt = await tx.getTransactionReceipt();

        if (receipt.from === this.wallet.address) {
          this.log('execution request', { executionId, params });
          this.registerExecution(executionId, params);
        } else {
          this.log('execution requested', { executionId, params });
        }
      }
    );

    this.enforcer.on(
      this.enforcer.filters.Registered(),
      async (execId, solverAddr, executionResultId, endHash, executionDepth, resultHash, tx) => {
        if (solverAddr !== this.wallet.address) {
          this.validateExecution(execId, executionResultId);
        } else {
          this.log('execution result registered', execId);
        }
      }
    );

    this.enforcer.on(
      this.enforcer.filters.Slashed(),
      (execId, addr, tx) => {
        if (addr === this.wallet.address) {
          this.onSlashed(execId);
        }
      }
    );

    this.enforcer.on(
      this.enforcer.filters.DisputeInitialised(),
      (disputeId, execId, tx) => {
        let sol = this.solutions[execId];

        if (sol) {
          this.log('new dispute for', execId);
          this.initDispute(disputeId, sol);
        }
      }
    );

    this.verifier.on(
      this.verifier.filters.DisputeNewRound(),
      (disputeId, timeout, solverPath, challengerPath, tx) => {
        let o = this.disputes[disputeId];

        if (o) {
          this.log(`dispute(${disputeId}) new round`);
          this.submitRound(disputeId);
        }
      }
    );
  }

  onSlashed (execId) {
  }

  log (...args) {
    console.log(this.logTag, ':', ...args);
  }

  async requestExecution (evmParameter) {
    let tx = await this.enforcer.request(evmParameter);

    tx = await tx.wait();

    const executionId = tx.events[0].args.executionId;

    return { executionId, evmParameter };
  }

  async registerExecution (executionId, evmParams) {
    // make the last step invalid
    const res = await this.computeCall(evmParams, true);
    const bondAmount = await this.enforcer.bondAmount();

    this.log('registering execution:', res.steps.length, 'steps');

    let tx = await this.enforcer.register(
      executionId,
      res.merkle.root.hash,
      res.merkle.depth,
      ZERO_HASH,
      { value: bondAmount }
    );

    tx = await tx.wait();

    const evt = tx.events[0].args;

    this.solutions[evt.executionId] = res;
  }

  async validateExecution (execId, execResultId) {
    this.log('validating execution result', execResultId);

    const executionParams = this.executionParams[execId];
    const executionResult = await this.enforcer.executionResults(execResultId);

    const res = await this.computeCall(executionParams);

    const solverHash = executionResult.endHash;
    const challengerHash = res.merkle.root.hash;

    // TODO: MerkleTree resizing
    // check execution length and resize tree if necessary

    this.log('solverHash', solverHash);
    this.log('challengerHash', challengerHash);

    if (solverHash !== challengerHash) {
      const bondAmount = await this.enforcer.bondAmount();

      let tx = await this.enforcer.dispute(
        execResultId,
        challengerHash,
        executionParams,
        { value: bondAmount, gasLimit: this.gasLimit }
      );

      tx = await tx.wait();

      let disputeId = tx.events[0].topics[1];

      this.initDispute(disputeId, res);
      return;
    }

    this.log('same execution result');
  }

  initDispute (disputeId, res) {
    this.log('initDispute', disputeId);

    let obj = {
      merkle: res.merkle,
      depth: res.merkle.depth,
      computationPath: res.merkle.root,
    };

    this.disputes[disputeId] = obj;

    this.submitRound(disputeId);
  }

  async submitRound (disputeId) {
    const obj = this.disputes[disputeId];

    if (obj.computationPath.isLeaf) {
      this.log('reached leaves');
      this.log('submitting for l=' +
        obj.computationPath.left.hash + ' r=' + obj.computationPath.right.hash);

      await this.submitProof(disputeId, obj.computationPath);
      return;
    }

    const dispute = await this.verifier.disputes(disputeId);
    const targetPath = this.wallet.address === dispute.challengerAddr ? dispute.challengerPath : dispute.solverPath;
    const path = this.wallet.address === dispute.challengerAddr ? dispute.challenger : dispute.solver;
    const nextPath = obj.merkle.getNode(targetPath);

    if (!nextPath) {
      this.log('submission already made by another party');
      obj.computationPath = obj.merkle.getPair(path.left, path.right);
      return;
    }

    if (obj.computationPath.left.hash === targetPath) {
      this.log('goes left from ' +
        obj.computationPath.hash.substring(2, 6) + ' to ' +
        obj.computationPath.left.hash.substring(2, 6)
      );
    } else if (obj.computationPath.right.hash === targetPath) {
      this.log('goes right from ' +
        obj.computationPath.hash.substring(2, 6) + ' to ' +
        obj.computationPath.right.hash.substring(2, 6)
      );
    }

    obj.computationPath = nextPath;

    let witnessPath;

    if (dispute.witness !== ZERO_HASH) {
      const path = obj.merkle.getNode(dispute.witness);

      witnessPath = { left: path.left.hash, right: path.right.hash };
    } else {
      witnessPath = { left: ZERO_HASH, right: ZERO_HASH };
    }

    let tx = await this.verifier.respond(
      disputeId,
      {
        left: obj.computationPath.left.hash,
        right: obj.computationPath.right.hash,
      },
      witnessPath,
      { gasLimit: this.gasLimit }
    );

    tx = await tx.wait();

    this.log('gas used', tx.gasUsed.toString());
  }

  async submitProof (disputeId, computationPath) {
    const args = ProofHelper.constructProof(computationPath);

    this.log('submitting proof - proofs', args.proofs);
    this.log('submitting proof - executionState', args.executionInput);

    let tx = await this.verifier.submitProof(
      disputeId,
      args.proofs,
      args.executionInput,
      { gasLimit: this.gasLimit }
    );

    tx = await tx.wait();

    this.log('submitting proof - gas used', tx.gasUsed.toString());

    return tx;
  }

  async computeCall (evmParams, invalidateLastStep) {
    let bytecode = await this.getCodeForParams(evmParams);
    let data = await this.getDataForParams(evmParams);
    let code = [];
    let len = bytecode.length;

    for (let i = 2; i < len;) {
      code.push(bytecode.substring(i, i += 2));
    }

    const stepper = new OffchainStepper();
    const steps = await stepper.run({ code, data });
    if (invalidateLastStep) {
      this.log('making one execution step invalid');
      steps[steps.length - 1].gasRemaining = 22;
    }
    const merkle = new Merkelizer().run(steps, bytecode, data);

    return { steps, merkle };
  }
};
