'use strict';

const Verifier = artifacts.require('Verifier');
const Enforcer = artifacts.require('Enforcer');

module.exports = async (deployer) => {
  const deployVars = {
    verifierTimeout: process.env.verifierTimeout,
    taskPeriod: process.env.taskPeriod,
    challengePeriod: process.env.challengePeriod,
    bondAmount: process.env.bondAmount,
    maxExecutionDepth: process.env.maxExecutionDepth,
  };

  console.log(deployVars);
  for (let key in deployVars) {
    if (!deployVars[key]) {
      throw new Error(`${key} not defined via environment`);
    }
  }

  // XXX: why this strange interface for first deploy?
  const verifier = await deployer.deploy(Verifier, deployVars.verifierTimeout).await;
  const enforcer = await deployer.deploy(
    Enforcer,
    verifier.address,
    deployVars.taskPeriod,
    deployVars.challengePeriod,
    deployVars.bondAmount,
    deployVars.maxExecutionDepth
  );

  console.log('verifier.setEnforcer', enforcer.address);
  await verifier.setEnforcer(enforcer.address);
};
