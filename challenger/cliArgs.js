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
];

const parser = dashdash.createParser({ options });

/**
 * @type {{
 *  ethProvider: string;
 *  walletPriv: string;
 *  enforcerAddr: string;
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

if (!cliArgs.walletPriv) {
  console.log('walletPriv is required. See --help for reference');
  process.exit(0);
}

if (!cliArgs.ethProvider) {
  console.log('ethProvider is required. See --help for reference');
  process.exit(0);
}

module.exports = cliArgs;