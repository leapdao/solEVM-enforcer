'use strict';

const ethers = require('ethers');
const BigNumber = require('bignumber.js');
const { ExecutionPoker, executionId } = require('./ExecutionPoker');

const cliArgs = require('./cliArgs');

let Enforcer;
let Verifier;
try {
  Enforcer = require('../build/contracts/Enforcer.json');
  Verifier = require('../build/contracts/Verifier.json');
} catch (e) {
  console.error('Please run `npm run compile:contracts` first. 😉');
  process.exit(1);
}

const fromWei = (wei) => {
  const dec = new BigNumber(10).pow(18);
  return new BigNumber(wei).div(dec).toString();
};

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(cliArgs.ethProvider);
  const wallet = new ethers.Wallet(cliArgs.walletPriv, provider);
  const enforcer = new ethers.Contract(cliArgs.enforcerAddr, Enforcer.abi, provider);
  const verifierAddr = await enforcer.verifier();
  const balance = await wallet.getBalance();
  console.log(`Wallet: ${wallet.address} (${fromWei(balance)} ETH)`);
  console.log(`Enforcer: ${cliArgs.enforcerAddr}`);
  console.log(`Verfier: ${verifierAddr}`);
  const verifier = new ethers.Contract(verifierAddr, Verifier.abi, provider);

  new ExecutionPoker(db, enforcer, verifier, wallet, 3000000, 'challenger'); // eslint-disable-line
})();

function onException (e) {
  console.error(e);
  process.exit(1);
}

process.on('uncaughtException', onException);
process.on('unhandledRejection', onException);
