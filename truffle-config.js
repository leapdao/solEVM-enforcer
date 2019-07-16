'use strict';
const HDWalletProvider = require('truffle-hdwallet-provider');

module.exports = {
  compilers: {
    solc: {
      version: '0.5.2',
      settings: {
        optimizer: {
          enabled: true,
          runs: 2,
        },
        evmVersion: 'constantinople',
      },
    },
  },
  networks: {
    goerli: {
      provider: () => {
        return new HDWalletProvider(process.env.MNEMONIC, 'https://goerli.infura.io/v3/' + process.env.INFURA_API_KEY);
      },
      network_id: '5', // eslint-disable-line camelcase
      gas: 6465030,
      gasPrice: 10000000000,
    },
    ganache: {
      host: 'localhost',
      port: 8111,
      network_id: '*', // eslint-disable-line camelcase
      gas: 0xffffff,
      gasPrice: 0x01,
    },
    geth: {
      host: 'localhost',
      port: 8222,
      network_id: '*', // eslint-disable-line camelcase
      gas: 0xffffff,
      gasPrice: 0x01,
    },
    gasPrice: {
      host: 'localhost',
      port: 8222,
      network_id: '*', // eslint-disable-line camelcase
      gas: 0xffffff,
      gasPrice: 3 * (10 ** 9),
    },
  },
};
