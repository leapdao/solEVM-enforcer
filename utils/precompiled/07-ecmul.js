'use strict';

const utils = require('ethereumjs-util');
const BN = utils.BN;

const bn128 = require('rustbn.js');

module.exports = function (gasLimit, data) {
  const results = {};

  results.gasUsed = new BN(40000);

  if (gasLimit.lt(results.gasUsed)) {
    results.returnValue = Buffer.alloc(0);
    results.exception = 0;
    results.gasUsed = new BN(gasLimit);
    return results;
  }

  const returnData = bn128.mul(data);

  // check ecmul success or failure by comparing the output length
  if (returnData.length !== 64) {
    results.returnValue = Buffer.alloc(0);
    results.exception = 0;
    results.gasUsed = new BN(gasLimit);
  } else {
    results.returnValue = returnData;
    results.exception = 1;
  }

  return results;
};
