'use strict';

const ethers = require('ethers');

const HydratedRuntime = require('../utils/HydratedRuntime.js');
const Merkelizer = require('../utils/Merkelizer.js');
const ProofHelper = require('../utils/ProofHelper.js');
const FragmentTree = require('../utils/FragmentTree');
const { ZERO_HASH } = require('../utils/constants.js');
const cliArgs = require('./cliArgs');

const executionId = (taskHash, pathRoot) => {
  return ethers.utils.solidityKeccak256(
    ['bytes32', 'bytes32'],
    [taskHash, pathRoot]
  );
};

exports.executionId = executionId;

exports.ExecutionPoker = class ExecutionPoker {
  constructor (enforcer, verifier, wallet, gasLimit = 0xfffffffffffff, logTag = 'unkn') {
    this.enforcer = enforcer.connect(wallet);
    this.verifier = verifier.connect(wallet);
    this.wallet = wallet;
    this.gasLimit = gasLimit;
    this.logTag = logTag;
    // TODO: this needs to be garbage collected
    this.taskParams = {};
    this.taskCallData = {};
    this.disputes = {};
    this.solutions = {};

    this.alwaysChallenge = true;

    const requestedHandler = async (taskHash, parameters, callData, tx) => {
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
      this.taskParams[taskHash] = params;
      this.taskCallData[params.dataHash] = callData;

      const receipt = await tx.getTransactionReceipt();

      this.log('task request', { taskHash, params });
      if (cliArgs.delay) {
        setTimeout(() => {
          this.registerExecution(taskHash, params);
        }, cliArgs.delay);
      } else {
        this.registerExecution(taskHash, params);
      }
    };
    this.enforcer.on(
      this.enforcer.filters.Requested(),
      requestedHandler,
    );

    const registeredHandler = async (taskHash, solverPathRoot, executionDepth, resultBytes, tx) => {
      const receipt = await tx.getTransactionReceipt();

      if (receipt.from === this.wallet.address) {
        this.log('execution result registered', taskHash);
      } else {
        this.validateExecution(taskHash, solverPathRoot, executionDepth, resultBytes);
      }
    };
    this.enforcer.on(
      this.enforcer.filters.Registered(),
      registeredHandler
    );

    const slashedHandler = (execId, addr, tx) => {
      if (addr === this.wallet.address) {
        console.log('slashed', execId);
        this.onSlashed(execId);
      } else {
        // const entries = Object.entries(this.disputes);
        // const index = entries.findIndex(([, d]) => d.execId === execId);
        // if (index > -1) {
        //   const [disputeId, dispute] = entries[index];
        //   if (dispute.challengerAddr === addr) {
        //     this.onWin(execId, disputeId);
        //   }
        // }
      }
    };
    this.enforcer.on(
      this.enforcer.filters.Slashed(),
      slashedHandler
    );

    const disputeHandler = (disputeId, execId, tx) => {
      if (this.solutions[execId] && !this.disputes[disputeId]) {
        this.log('new dispute for', execId);
        this.initDispute(disputeId, execId, tx.from, this.solutions[execId].result);
      }
    };
    this.enforcer.on(
      this.enforcer.filters.DisputeInitialised(),
      disputeHandler
    );

    const newRoundHandler = (disputeId, timeout, solverPath, challengerPath, tx) => {
      this.log(`dispute(${disputeId}) new round`, !!this.disputes[disputeId]);
      if (this.disputes[disputeId]) {
        this.submitRound(disputeId);
      }
    };
    this.verifier.on(
      this.verifier.filters.DisputeNewRound(),
      newRoundHandler,
    );

    let baseNonce = wallet.getTransactionCount();
    let nonceOffset = 0;
    this.getNonce = () => {
      return baseNonce.then((nonce) => (nonce + (nonceOffset++)));
    };
  }

  onSlashed (execId) {
  }

  onWin (execId, disputeId) {
  }

  log (...args) {
    console.log(this.logTag, ':', ...args);
  }

  async requestExecution (evmParameter, callData) {
    console.log('nonce', await this.wallet.getTransactionCount());
    let tx = await this.enforcer.request(evmParameter, callData);

    tx = await tx.wait();

    const taskHash = tx.events[0].args.taskHash;

    return { taskHash, evmParameter };
  }

  async registerResult (taskHash, result) {
    const lastExecutionStep = result.steps[result.steps.length - 1];
    const returnData = lastExecutionStep ? lastExecutionStep.returnData : '0x';
    const bondAmount = await this.enforcer.bondAmount();


    try {
      let solverPathRoot = result.merkle.root.hash;

      if (!cliArgs.onlyChallenger) {
        this.log('registering execution:', result.steps.length, 'steps');
        let tx = await this.enforcer.register(
          taskHash,
          solverPathRoot,
          new Array(result.merkle.depth).fill(ZERO_HASH),
          returnData,
          { value: bondAmount, nonce: await this.getNonce() }
        );

        tx = await tx.wait();
      } else {
        this.log('onlyChallenger. Execution:', result.steps.length, 'steps');
      }

      this.solutions[executionId(taskHash, solverPathRoot)] = {
        result,
        taskHash,
      };
    } catch (e) {
      console.error('registerResult', e);
    }
  }

  async registerExecution (taskHash, evmParams) {
    const result = await this.computeCall(evmParams);
    try {
      return this.registerResult(taskHash, result);
    } catch (e) {
      console.error('registerExecution', e);
    }
  }

  async validateExecution (taskHash, solverHash, executionDepth, resultBytes) {
    const execId = executionId(taskHash, solverHash);
    this.log('validating execution result', execId);

    // TODO: MerkleTree resizing
    // check execution length and resize tree if necessary
    const taskParams = this.taskParams[taskHash];
    const res = await this.computeCall(taskParams);

    // TODO: handle the bigger case too
    if (executionDepth < res.merkle.depth) {
      // scale down
      res.merkle.tree[0] = res.merkle.tree[0].slice(0, 2 ** (executionDepth.toNumber() - 1));
      // recalculate tree
      res.merkle.recal();
    }

    const challengerHash = res.merkle.root.hash;

    this.log('solverHash', solverHash);
    this.log('challengerHash', challengerHash);

    if (solverHash !== challengerHash) {
      const bondAmount = await this.enforcer.bondAmount();

      try {
        let tx = await this.enforcer.dispute(
          solverHash,
          challengerHash,
          taskParams,
          { value: bondAmount, gasLimit: this.gasLimit, nonce: await this.getNonce() }
        );

        tx = await tx.wait();

        let disputeId = tx.events[0].topics[1];
        if (!this.disputes[disputeId]) {
          this.initDispute(disputeId, execId, this.wallet.address, res);
        }
      } catch (e) {
        console.error('validateExecution', e);
      }
      return;
    }

    this.log('same execution result');
  }

  initDispute (disputeId, execId, challengerAddr, res) {
    this.log('initDispute', disputeId);

    this.disputes[disputeId] = {
      result: res,
      merkle: res.merkle,
      depth: res.merkle.depth,
      computationPath: res.merkle.root,
      codeFragmentTree: res.codeFragmentTree,
      execId,
      challengerAddr,
    };

    this.submitRound(disputeId);
  }

  async submitRound (disputeId) {
    const obj = this.disputes[disputeId];

    if (obj.computationPath.isLeaf) {
      this.log('reached leaves');
      this.log('submitting for l=' +
        obj.computationPath.left.hash + ' r=' + obj.computationPath.right.hash);

      await this.submitProof(disputeId, obj);
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

    // let d = await this.verifier.disputes(disputeId);
    // console.log(disputeId, d, {
    //   left: obj.computationPath.left.hash,
    //   right: obj.computationPath.right.hash,
    // }, witnessPath);
    try {
      let tx = await this.verifier.respond(
        disputeId,
        {
          left: obj.computationPath.left.hash,
          right: obj.computationPath.right.hash,
        },
        witnessPath,
        { gasLimit: this.gasLimit, nonce: await this.getNonce() }
      );

      tx = await tx.wait();

      this.log('gas used', tx.gasUsed.toString(), tx.transactionHash);
    } catch (e) {
      console.error('Submit round', e, {
        left: obj.computationPath.left.hash,
        right: obj.computationPath.right.hash,
        witnessPath,
        disputeId,
      });
    }
  }

  async submitProof (disputeId, disputeObj) {
    const args = ProofHelper.constructProof(disputeObj.computationPath, disputeObj);

    this.log('submitting proof - proofs', args.proofs);
    this.log('submitting proof - executionState', args.executionInput);

    try {
      let tx = await this.verifier.submitProof(
        disputeId,
        args.proofs,
        args.executionInput,
        { gasLimit: this.gasLimit, nonce: await this.getNonce() }
      );

      tx = await tx.wait();

      this.log('submitting proof - gas used', tx.gasUsed.toString(), tx.transactionHash);

      return tx;
    } catch (e) {
      console.error('submitProff', e);
    }
  }

  async computeCall (evmParams) {
    let bytecode = await this.getCodeForParams(evmParams);
    let data = await this.getDataForParams(evmParams);
    let code = [];
    let len = bytecode.length;

    for (let i = 2; i < len;) {
      code.push(bytecode.substring(i, i += 2));
    }

    let codeFragmentTree;
    // code is not on chain-🍕
    if (!evmParams.codeHash.endsWith('000000000000000000000000')) {
      codeFragmentTree = new FragmentTree().run(bytecode);
    }

    const runtime = new HydratedRuntime();
    const steps = await runtime.run({ code, data });
    const merkle = new Merkelizer().run(steps, bytecode, data, evmParams.customEnvironmentHash);

    return { steps, merkle, codeFragmentTree };
  }

  async getCodeForParams (evmParams) {
    const addr = evmParams.codeHash.substring(0, 42);
    return this.wallet.provider.getCode(addr);
  }

  async getDataForParams (evmParams) {
    if (Math.random() <= cliArgs.invalidChallengeRate) {
      return '0x686109bb000000000000000000000000000000000000000000000000000000000001178bd090f4ff7002c589483c11ed353fed58d4fe9c8a25903cbd4467f4be787054be'; // eslint-disable-line
    }
    return this.taskCallData[evmParams.dataHash];
  }
};
