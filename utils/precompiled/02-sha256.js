'use strict';

const utils = require('ethereumjs-util');
const BN = utils.BN;

module.exports = function (gasLimit, data) {
  const results = {};

  results.gasUsed = new BN(60);
  results.gasUsed.iadd(new BN(12).imuln(Math.ceil(data.length / 32)));

  if (gasLimit.lt(results.gasUsed)) {
    results.returnValue = Buffer.alloc(0);
    results.gasUsed = gasLimit;
    results.exception = 0;
    return results;
  }

  results.returnValue = utils.sha256(data);
  results.exception = 1;

  return results;
};
