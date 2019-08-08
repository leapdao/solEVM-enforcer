'use strict';

const utils = require('ethereumjs-util');
const BN = utils.BN;

module.exports = function (gasLimit, data) {
  const results = {};

  results.gasUsed = new BN(3000);

  if (gasLimit.lt(results.gasUsed)) {
    results.returnValue = Buffer.alloc(0);
    results.gasUsed = gasLimit;
    results.exception = 0;
    return results;
  }

  const paddedData = utils.setLengthRight(data, 128);
  const msgHash = paddedData.slice(0, 32);
  const v = paddedData.slice(32, 64);
  const r = paddedData.slice(64, 96);
  const s = paddedData.slice(96, 128);

  let publicKey;
  try {
    publicKey = utils.ecrecover(msgHash, new BN(v).toNumber(), r, s);
  } catch (e) {
    results.returnValue = Buffer.alloc(0);
    results.exception = 1;
    return results;
  }

  results.returnValue = utils.setLengthLeft(utils.publicToAddress(publicKey), 32);
  results.exception = 1;

  return results;
};
