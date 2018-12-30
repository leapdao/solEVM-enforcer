require('@babel/register');
require('@babel/polyfill');

module.exports = {
  compilers: {
    solc: {
      version: '0.5.2',
      settings: {
        optimizer: {
          enabled: true,
          runs: 2,
        },
        // TODO: the code is supposed to work on constantinople EVM but fails if this is switched on
        evmVersion: 'byzantium',
      },
    },
  },
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
      gas: 0xfffffffffffff,
      gasPrice: 0x01,
    },
    ganache: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // eslint-disable-line camelcase
      gas: 0xfffffffffffff,
      gasPrice: 0x01,
    },
  },
};
