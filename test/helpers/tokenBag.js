'use strict';

const assert = require("assert");
const { utils } = require("ethers");

const { BLOCK_GAS_LIMIT, ZERO_ADDRESS, ZERO_HASH } = require('../../utils/constants');

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
};

TokenBagHelpers.emptyOutput = () => {
    return {
	owner: ZERO_ADDRESS,
	valueOrId: 0x0,
	data: ZERO_HASH,
	color: ZERO_ADDRESS,
    };
};

TokenBagHelpers.emptyTokenBag = () => {
    return { bag: Array.apply(null, Array(16)).map(TokenBagHelpers.emptyOutput)};
};

TokenBagHelpers.padTokenBag = (tokenBag) => {
    while(tokenBag.length < 16) {
	tokenBag.push(TokenBagHelpers.emptyOutput());
    }
    return { bag: tokenBag };
}

module.exports = TokenBagHelpers;
