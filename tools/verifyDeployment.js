#!/usr/bin/env node

'use strict';

const provider = require('ethers').getDefaultProvider(process.env.network);

(async function () {
  const verifierCode = await provider.getCode(process.env.verifier);
  const enforcerCode = await provider.getCode(process.env.enforcer);

  const verifierRefCode = require('./../build/contracts/Verifier.json').deployedBytecode;
  const enforcerRefCode = require('./../build/contracts/Enforcer.json').deployedBytecode;

  console.log('Verifier bytecode is the same:', verifierRefCode === verifierCode);
  console.log('Enforcer bytecode is the same:', enforcerRefCode === enforcerCode);
})();
