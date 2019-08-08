#!/usr/bin/env node

'use strict';

const ethers = require('ethers');

const Verifier = require('../build/contracts/Verifier.json');
const Enforcer = require('../build/contracts/Enforcer.json');

async function deployContract (wallet, artifact, ...args) {
  const _factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );
  const contract = await _factory.deploy(...args);
  const tx = await contract.deployTransaction.wait();

  console.log(`\n
Contract: ${artifact.contractName}
  Address: ${contract.address}
  Transaction Hash: ${tx.transactionHash}
  Deployer: ${tx.from}
  Gas used: ${tx.cumulativeGasUsed.toString()}
  Gas fee in Ether: ${ethers.utils.formatUnits(contract.deployTransaction.gasPrice.mul(tx.cumulativeGasUsed), 'ether')}
  `);

  return contract;
};

/// Additionally to the deployment variables
/// you also have to provide the network (the network name in truffle-config).
///
/// If the RPC provider does not support signing,
/// you have to supply either `privKey|PRIV_KEY` or `mnemonic|MNEMONIC`
/// as environment variables to this script.
(async function () {
  if (!process.env.network) {
    console.error('Please pass `network=` to this script.');
    process.exit(1);
  }

  const truffleConfig = require('../truffle-config');
  const network = truffleConfig.networks[process.env.network];
  const mnemonic = process.env.mnemonic || process.env.MNEMONIC;
  const privKey = process.env.privKey || process.env.PRIV_KEY;
  const provider = new ethers.providers.JsonRpcProvider(network.url);
  const txOverrides = {
    gasLimit: network.gas,
    gasPrice: network.gasPrice,
  };

  let wallet;

  if (privKey) {
    wallet = new ethers.Wallet(privKey, provider);
  } else if (mnemonic) {
    wallet = ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
  } else {
    wallet = provider.getSigner();
  }

  const deployVars = {
    verifierTimeout: process.env.verifierTimeout,
    taskPeriod: process.env.taskPeriod,
    challengePeriod: process.env.challengePeriod,
    bondAmount: process.env.bondAmount,
    maxExecutionDepth: process.env.maxExecutionDepth,
  };

  console.log('Deployment variables:');
  for (let key in deployVars) {
    if (!deployVars[key]) {
      console.error(`${key} not defined via environment`);
      process.exit(1);
    }
    console.log(`  ${key} = ${deployVars[key]}`);
  }

  const verifier = await deployContract(
    wallet,
    Verifier,
    deployVars.verifierTimeout,
    txOverrides
  );
  const enforcer = await deployContract(
    wallet,
    Enforcer,
    verifier.address,
    deployVars.taskPeriod,
    deployVars.challengePeriod,
    deployVars.bondAmount,
    deployVars.maxExecutionDepth,
    txOverrides
  );

  console.log('verifier.setEnforcer', enforcer.address);
  await (await verifier.setEnforcer(enforcer.address, txOverrides)).wait();
})();
