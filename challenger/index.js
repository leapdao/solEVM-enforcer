const level = require('level');
const ethers = require('ethers');
const { ExecutionPoker } = require('../utils');

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

class MyExecutionPoker extends ExecutionPoker {}

(async () => {
  const db = level('solEVM');
  const provider = new ethers.providers.JsonRpcProvider(cliArgs.ethProvider);
  const wallet = new ethers.Wallet(cliArgs.walletPriv, provider);
  const enforcer = new ethers.Contract(cliArgs.enforcerAddr, Enforcer.abi, provider);
  const verifierAddr = await enforcer.verifier();
  const verifier = new ethers.Contract(verifierAddr, Verifier.abi, provider);
  const executionPoker = new MyExecutionPoker(enforcer, verifier, wallet);

})();