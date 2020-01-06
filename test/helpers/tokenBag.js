'use strict';

const assert = require("assert");
const { utils } = require("ethers"); 

const TokenBagHelpers = {};

TokenBagHelpers.assertTokenBagEqual = (expected, actual) => {
    expected.bag.forEach((expectedOutput, i) => {
	const actualOutput = actual.bag[i];
	assert.equal(
	    expectedOutput.owner.replace('0x', ''),
	    actualOutput.owner.toLowerCase().replace('0x', '')
	);
	assert.equal(expectedOutput.color, actualOutput.color.toLowerCase());
	assert.equal(expectedOutput.data, actualOutput.data);
	assert.equal(
	    expectedOutput.valueOrId,
	    utils.hexZeroPad(actualOutput.valueOrId.toHexString(), 32)
	);
    });
}

module.exports = TokenBagHelpers;
