#!/usr/bin/env node
'use strict';

const { ExecutionPoker, Merkelizer } = require('./../utils');

const fs = require('fs');
const ethers = require('ethers');
const ganache = require('ganache-cli');

const GAS_LIMIT = 0xfffffffffffff;
const EVMParameters = {
  origin: '0xa1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1',
  target: '0xfeefeefeefeefeefeefeefeefeefeefeefeefee0',
  blockHash: '0xdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdc',
  blockNumber: 123,
  time: 1560775755,
  txGasLimit: 0xffffffffff,
  customEnvironmentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  codeHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  dataHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
};

class MyExecutionPoker extends ExecutionPoker {
  onSlashed (execId) {
    this.log(`got slashed, executionId(${execId})`);
    // we are done
    process.exit(0);
  }

  async requestExecution (contractAddr, callData) {
    const codeHash = `0x${contractAddr.replace('0x', '').toLowerCase().padEnd(64, '0')}`;
    const dataHash = Merkelizer.dataHash(callData);
    const evmParams = Object.assign(EVMParameters, { codeHash, dataHash });

    return super.requestExecution(evmParams, callData);
  }

  async submitProof (disputeId, computationPath) {
    try {
      await super.submitProof(disputeId, computationPath);
    } catch (e) {
      // ignore for unit test
    }
  }

  async computeCall (evmParams) {
    const res = await super.computeCall(evmParams);

    if (this.logTag === 'solver') {
      this.log('making one leaf invalid');

      const leaf = res.merkle.leaves[0];
      leaf.right.executionState.gasRemaining = 2222;
      leaf.right.hash = Merkelizer.stateHash(leaf.right.executionState, leaf.right.stackHash, leaf.right.memHash);
      leaf.hash = Merkelizer.hash(leaf.left.hash, leaf.right.hash);
      res.merkle.recal(0);
    }

    return res;
  }
}

async function deployContract (truffleContract, wallet, ...args) {
  const _factory = new ethers.ContractFactory(
    truffleContract.abi,
    truffleContract.bytecode,
    wallet
  );
  const contract = await _factory.deploy(...args, { gasLimit: GAS_LIMIT });

  await contract.deployed();

  return contract;
}

async function main () {
  let Verifier;
  let Enforcer;

  try {
    Verifier = require('./../build/contracts/Verifier.json');
    Enforcer = require('./../build/contracts/Enforcer.json');
  } catch (e) {
    console.error('Please run `npm run compile:contracts` first. 😉');
    return;
  }

  if (process.argv.length < 3) {
    console.log(
      'Usage: pathToContract.json functionName functionArgs\n' +
      'Example:' +
      '\n\tbuild/contracts/SpendingConditionMock.json test 0xD8992E08C1Fb17775deF02e15B620A006c4726db [] []'
    );

    process.exit(0);
  }

  let deployerWallet = ethers.Wallet.createRandom();
  let solverWallet = ethers.Wallet.createRandom();
  let challengerWallet = ethers.Wallet.createRandom();

  const accounts = [
    { secretKey: deployerWallet.privateKey, balance: ethers.constants.MaxUint256 },
    { secretKey: solverWallet.privateKey, balance: ethers.constants.MaxUint256 },
    { secretKey: challengerWallet.privateKey, balance: ethers.constants.MaxUint256 },
  ];

  const provider = ganache.provider({ locked: false, accounts: accounts, gasLimit: GAS_LIMIT });
  global.provider = provider;

  // yes, we need a new Web3Provider. Otherwise we get duplicate events -.-
  deployerWallet = deployerWallet.connect(new ethers.providers.Web3Provider(provider));
  solverWallet = solverWallet.connect(new ethers.providers.Web3Provider(provider));
  challengerWallet = challengerWallet.connect(new ethers.providers.Web3Provider(provider));

  // faster unit tests :)
  solverWallet.provider.pollingInterval = 30;
  challengerWallet.provider.pollingInterval = 30;

  const timeout = 10;
  const taskPeriod = 100000;
  const challengePeriod = 10000;
  const bondAmount = 1;
  const maxExecutionDepth = 10;

  console.log(
    `Deploying Verifier & Enforcer\n\
    \tTimeout: ${timeout}\n\tChallengePeriod: ${challengePeriod}\n\tBond amount: ${bondAmount}`
  );

  const verifier = await deployContract(Verifier, deployerWallet, timeout);
  const enforcer = await deployContract(
    Enforcer,
    deployerWallet,
    verifier.address,
    taskPeriod,
    challengePeriod,
    bondAmount,
    maxExecutionDepth
  );

  let tx = await verifier.setEnforcer(enforcer.address);

  await tx.wait();

  console.log(`Verifier contract: ${verifier.address}`);
  console.log(`Enforcer contract: ${enforcer.address}`);

  console.log(`Solver wallet: ${solverWallet.address}`);
  console.log(`Challenger wallet: ${challengerWallet.address}`);

  // challenger
  // eslint-disable-next-line no-new
  new MyExecutionPoker(
    enforcer,
    verifier,
    challengerWallet,
    GAS_LIMIT,
    'challenger'
  );

  fs.realpath(process.argv[2], async function (err, path) {
    if (err) {
      onException(err);
      return;
    }

    const args = process.argv.slice(3, process.argv.length);
    const functionName = args.shift();
    const functionArgs = [];

    while (args.length) {
      const e = preParse(args.shift());
      functionArgs.push(JSON.parse(e));
    }

    const contr = require(path);
    const target = await deployContract(contr, solverWallet);

    if (!target.interface.functions[functionName]) {
      console.log('available functions');
      console.log(target.functions);
      process.exit(0);
    }

    console.log('function arguments for', functionName, '\n', functionArgs);

    const data = target.interface.functions[functionName].encode(functionArgs);

    console.log('callData', data);

    const execPoker = new MyExecutionPoker(
      enforcer,
      verifier,
      solverWallet,
      GAS_LIMIT,
      'solver'
    );
    // will kick solver and later the challenger :)
    execPoker.requestExecution(target.address, data);
  });
}

function preParse (str) {
  const len = str.length;
  let res = '';
  let openToken = false;

  for (let i = 0; i < len; i++) {
    let v = str[i];

    if (openToken && (v === ',' || v === ']' || v === ' ')) {
      res += '"';
      openToken = false;
    }

    if (v === '0' && str[i + 1] === 'x') {
      res += '"';
      openToken = true;
    }

    res += v;
  }

  if (openToken) {
    res += '"';
  }

  return res;
}

function onException (e) {
  console.error(e);
  process.exit(1);
}

process.on('uncaughtException', onException);
process.on('unhandledRejection', onException);

main();
