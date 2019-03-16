
import ExecutionPoker from './ExecutionPoker';

const fs = require('fs');
const ethers = require('ethers');
const ganache = require('ganache-cli');

const GAS_LIMIT = 0xfffffffffffff;

let submissionCounter = 0;

class MyExecutionPoker extends ExecutionPoker {
  onSlashed (execId) {
    this.log(`got slashed, executionId(${execId})`);
    // we are done
    process.exit(0);
  }

  async submitProof (disputeId, computationPath) {
    await super.submitProof(disputeId, computationPath);

    submissionCounter++;

    if (submissionCounter === 2) {
      const timeoutDuration = (await this.verifier.timeoutDuration()).toNumber();

      this.log('Verifier timeoutDuration', timeoutDuration);
      this.log(`mining ${timeoutDuration} blocks to be able to call claimTimeout`);

      for (let i = 0; i < timeoutDuration; i++) {
        await this.wallet.provider.send('evm_mine', []);
      }

      this.log('calling Verifier.claimTimeout');

      let tx = await this.verifier.claimTimeout(disputeId, { gasLimit: this.gasLimit });
      tx = await tx.wait();

      this.log('claimTimeout gasUsed - ', tx.gasUsed.toNumber());
    }
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
    Verifier = require('./../../build/contracts/Verifier.json');
    Enforcer = require('./../../build/contracts/Enforcer.json');
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

  let timeout = 100;
  let challengePeriod = 1000;
  let bondAmount = 1;

  console.log(
    `Deploying Verifier & Enforcer\n\
    \tTimeout: ${timeout}\n\tChallengePeriod: ${challengePeriod}\n\tBond amount: ${bondAmount}`
  );

  let verifier = await deployContract(Verifier, deployerWallet, timeout);
  let enforcer = await deployContract(Enforcer, deployerWallet, verifier.address, challengePeriod, bondAmount);

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

    let tmp = new MyExecutionPoker(
      enforcer,
      verifier,
      solverWallet,
      GAS_LIMIT,
      'solver'
    );
    tmp.registerExecution(target.address, data);
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
