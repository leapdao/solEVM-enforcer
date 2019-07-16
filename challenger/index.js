const level = require('level');
const ethers = require('ethers');
const ExecutionPoker = require('./ExecutionPoker');

const cliArgs = require('./cliArgs');

let Enforcer;
// let Verifier;
try {
  Enforcer = require('./enforcerMock.json');
  // Verifier = require('../build/contracts/Verifier.json');
} catch (e) {
  console.error('Please run `npm run compile:contracts` first. 😉');
  process.exit(1);
}

class MyExecutionPoker extends ExecutionPoker {
  constructor (db, ...args) {
    super(...args);
    this.db = db;
    // this.restoreSolutions();
    // this.solutions = new Proxy(this.solutions, {
    //   get (solutions, execId) {
    //     return solutions[execId];
    //   },
    //   set (solutions, execId, result) {
    //     solutions[execId] = result;

    //     this.db.put('solutions', JSON.stringify(solutions));
    //   },
    // });
  }

  restoreSolutions () {
    this.db.get('solutions').then(json => {
      this.solutions = JSON.parse(json); // ToDo: do proper deserialise here
    }).catch(() => {
      // do nothing
    });
  }
}

(async () => {
  const db = level('solEVM');
  const provider = new ethers.providers.JsonRpcProvider(cliArgs.ethProvider);
  const wallet = new ethers.Wallet(cliArgs.walletPriv, provider);
  const enforcer = new ethers.Contract(cliArgs.enforcerAddr, Enforcer, provider);
  console.log(`Wallet: ${wallet.address}`);
  // const verifierAddr = await enforcer.verifier();
  // const verifier = new ethers.Contract(verifierAddr, Verifier.abi, provider);

  // ExecutionPoker will do the rest ¯\_(ツ)_/¯
  new MyExecutionPoker(db, enforcer, wallet); // eslint-disable-line
})();

function onException (e) {
  console.error(e);
  process.exit(1);
}

process.on('uncaughtException', onException);
process.on('unhandledRejection', onException);
