'use strict';

const utils = require('ethereumjs-util');
const BN = utils.BN;
const bn128 = require('rustbn.js');

module.exports = function (gasLimit, data) {
  const results = {};
  // no need to care about non-divisible-by-192, because bn128.pairing will properly fail in that case
  const inputDataSize = Math.floor(data.length / 192);

  const gascost = 100000 + (inputDataSize * 80000);
  results.gasUsed = new BN(gascost);

  if (gasLimit.ltn(gascost)) {
    results.returnValue = Buffer.alloc(0);
    results.gasUsed = gasLimit;
    results.exception = 0;
    return results;
  }

  const returnData = bn128.pairing(data);

  // check ecpairing success or failure by comparing the output length
  if (returnData.length !== 32) {
    results.returnValue = Buffer.alloc(0);
    results.gasUsed = gasLimit;
    results.exception = 0;
  } else {
    results.returnValue = returnData;
    results.exception = 1;
  }

  return results;
};
