'use strict';

const dashdash = require('dashdash');

const options = [
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help',
  },
  {
    names: ['version'],
    type: 'bool',
    help: 'Print version',
  },
  {
    names: ['enforcerAddr'],
    type: 'string',
    env: 'ENFORCER_ADDR',
    help: 'Enforcer contract address',
  },
  {
    names: ['walletPriv'],
    type: 'string',
    env: 'WALLET_PRIV',
    help: 'Private key for signing transactions',
  },
  {
    names: ['ethProvider'],
    type: 'string',
    env: 'ETH_PROVIDER',
    help: 'Ethereum JSON RPC url',
  },
  {
    names: ['delay'],
    type: 'number',
    env: 'DELAY',
    help: 'Events handling delay (for temp setup)',
    default: 0,
  },
  {
    names: ['onlyChallenger'],
    type: 'bool',
    env: 'ONLY_CHALLENGER',
    help: 'Disables registering results, challenging only',
    default: false,
  },
  {
    names: ['invalidChallengeRate'],
    type: 'number',
    env: 'INVALID_CHALLENGE_RATE',
    help: 'Probability of wrong result (0-1)',
    default: 0,
  },
];

const parser = dashdash.createParser({ options });

/**
 * @type {{
 *  ethProvider: string;
 *  walletPriv: string;
 *  enforcerAddr: string;
 *  delay: number;
 *  invalidChallengeRate: number;
 *  onlyChallenger: boolean;
 * }}
 */
const cliArgs = parser.parse(process.argv);

if (cliArgs.help) {
  console.log('Usage:');
  console.log(parser.help({ includeEnv: true }).trimRight());
  process.exit(0);
}

if (cliArgs.version) {
  console.log(`v${require('./package.json').version}`); // eslint-disable-line
  process.exit(0);
}

if (!cliArgs.enforcerAddr) {
  console.log('enforcerAddr is required. See --help for reference');
  process.exit(0);
}

// ToDo: do not use plain private key here
// it will be saved in terminal history
// Much better would be to use a file with private key
if (!cliArgs.walletPriv) {
  console.log('walletPriv is required. See --help for reference');
  process.exit(0);
}

if (!cliArgs.ethProvider) {
  console.log('ethProvider is required. See --help for reference');
  process.exit(0);
}

module.exports = cliArgs;