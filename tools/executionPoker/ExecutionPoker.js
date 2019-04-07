
const Merkelizer = require('./../../utils/Merkelizer');
const OffchainStepper = require('./../../utils/OffchainStepper');

module.exports = class ExecutionPoker {
  constructor (enforcer, verifier, wallet, gasLimit, logTag) {
    this.enforcer = enforcer.connect(wallet);
    this.verifier = verifier.connect(wallet);
    this.wallet = wallet;
    this.gasLimit = gasLimit || 0xfffffffffffff;
    this.logTag = logTag || 'unkn';
    this.disputes = {};
    this.solutions = {};

    this.enforcer.on(
      this.enforcer.filters.Registered(),
      async (execId, addr, code, data, tx) => {
        if (addr !== this.wallet.address) {
          this.validateExecution(execId, code, data);
        } else {
          this.log('execution registered', execId);
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

  async registerExecution (contractAddr, data) {
    // make the last step invalid
    const res = await this.computeCall(contractAddr, data, true);
    const bondAmount = await this.enforcer.bondAmount();

    this.log('registering execution:', res.steps.length, 'steps');

    let tx = await this.enforcer.register(
      contractAddr,
      data,
      res.merkle.root.hash,
      res.merkle.depth,
      { value: bondAmount }
    );

    tx = await tx.wait();

    let evt = tx.events[0].args;

    this.solutions[evt.executionId] = res;
  }

  async validateExecution (execId, contractAddr, data) {
    this.log('validating execution', execId);

    const execution = await this.enforcer.executions(execId);
    const res = await this.computeCall(contractAddr, data);

    const solverHash = execution.endHash;
    const challengerHash = res.merkle.root.hash;

    // TODO: MerkleTree resizing
    // check execution length and resize tree if necessary

    console.log('solverHash', solverHash);
    console.log('challengerHash', challengerHash);

    if (solverHash !== challengerHash) {
      const bondAmount = await this.enforcer.bondAmount();

      let tx = await this.enforcer.dispute(
        contractAddr,
        data,
        challengerHash,
        res.merkle.depth,
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

    let tx = await this.verifier.respond(
      disputeId,
      {
        left: obj.computationPath.left.hash,
        right: obj.computationPath.right.hash,
      },
      { gasLimit: this.gasLimit }
    );

    tx = await tx.wait();

    this.log('gas used', tx.gasUsed.toString());
  }

  async submitProof (disputeId, computationPath) {
    const prevOutput = computationPath.left.executionState;
    const execState = computationPath.right.executionState;
    const ZERO_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

    const proofs = {
      stackHash: Merkelizer.stackHash(
        prevOutput.stack.slice(0, prevOutput.stack.length - execState.compactStack.length)
      ),
      memHash: execState.isMemoryRequired ? ZERO_HASH : Merkelizer.memHash(prevOutput.mem),
      dataHash: execState.isCallDataRequired ? ZERO_HASH : Merkelizer.dataHash(prevOutput.data),
    };

    const execStateArgs = {
      data: '0x' + (execState.isCallDataRequired ? prevOutput.data : ''),
      stack: execState.compactStack,
      mem: '0x' + (execState.isMemoryRequired ? prevOutput.mem : ''),
      returnData: '0x' + prevOutput.returnData,
      logHash: '0x' + prevOutput.logHash,
      pc: prevOutput.pc,
      gasRemaining: prevOutput.gasRemaining,
    };

    this.log('submitting proof - proofs', proofs);
    this.log('submitting proof - executionState', execStateArgs);

    let tx = await this.verifier.submitProof(
      disputeId,
      proofs,
      execStateArgs,
      { gasLimit: this.gasLimit }
    );

    tx = await tx.wait();

    this.log('submitting proof - gas used', tx.gasUsed.toString());

    return tx;
  }

  async computeCall (addr, data, invalidateLastStep) {
    let bytecode = await this.wallet.provider.getCode(addr);
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
    const merkle = new Merkelizer().run(steps, addr, data);

    return { steps, merkle };
  }
};
