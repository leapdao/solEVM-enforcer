'use strict';

const utils = require('ethereumjs-util');
const BN = utils.BN;

module.exports = function (gasLimit, data) {
  const results = {};

  results.gasUsed = new BN(15);
  results.gasUsed.iadd(new BN(3).imuln(Math.ceil(data.length / 32)));

  if (gasLimit.lt(results.gasUsed)) {
    results.returnValue = Buffer.alloc(0);
    results.gasUsed = gasLimit;
    results.exception = 0;
    return results;
  }

  results.returnValue = data;
  results.exception = 1;

  return results;
};
