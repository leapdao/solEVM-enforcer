'use strict';

const assert = require('assert');
const { utils } = require('ethers');

const { BN } = require('ethereumjs-util');

const {
  BLOCK_GAS_LIMIT,
  ZERO_ADDRESS,
  ZERO_HASH,
  ERC20TYPE,
  ERC1948TYPE,
  ERC721TYPE,
} = require('../../utils/constants');

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
    assert.equal(expectedOutput.tokenType, actualOutput.tokenType);
    if (actualOutput.valueOrId.toHexString) {
      assert.equal(
        expectedOutput.valueOrId,
        utils.hexZeroPad(actualOutput.valueOrId.toHexString(), 32)
      );
    } else {
      assert.equal(
        expectedOutput.valueOrId,
        actualOutput.valueOrId
      );
    }
  });
};

TokenBagHelpers.emptyOutput = () => {
  return {
    owner: ZERO_ADDRESS,
    valueOrId: 0x0,
    data: ZERO_HASH,
    color: ZERO_ADDRESS,
    tokenType: ERC20TYPE,
  };
};

TokenBagHelpers.emptyTokenBag = () => {
  return promote({ bag: Array.apply(null, Array(16)).map(TokenBagHelpers.emptyOutput) });
};

TokenBagHelpers.padTokenBag = (tokenBag) => {
  while(tokenBag.length < 16) {
    tokenBag.push(TokenBagHelpers.emptyOutput());
  }
  return promote({ bag: tokenBag });
};

function promote (tokenBag) {

  const bn = (hex) => {
    return new BN(hex.replace('0x', ''), 16);
  };

  function balanceOf (color, address) {
    return this.findToken({
      color: color,
      owner: address,
    }).valueOrId || 0;
  }

  function readData (color, tokenId) {
    return this.findToken({
      color: color,
      valueOrId: tokenId,
    }).data || ZERO_HASH;
  }

  function transferFrom (color, from, to, valueOrId) {
    if (to === ZERO_ADDRESS) return false;
    const source = this.findToken({
      color: color,
      owner: from,
    });
    if (!source) return false;
    if (source.tokenType === ERC20TYPE) {
      let dest;
      dest = this.findToken({
        color: color,
        owner: to,
      });
      if (!dest) {
        dest = this.findToken({
          color: ZERO_ADDRESS,
          owner: ZERO_ADDRESS,
        });
      }
      if (!dest) return false;
      if (bn(source.valueOrId).lt(bn(valueOrId))) return false;
      if (bn(valueOrId).add(bn(dest.valueOrId)).lt(bn(valueOrId))) return false;

      dest.owner = to;
      dest.color = color;
      source.valueOrId = '0x' + bn(source.valueOrId).sub(bn(valueOrId)).toString(16, 64);
      dest.valueOrId = '0x' + bn(dest.valueOrId).add(bn(valueOrId)).toString(16, 64);

      return true;
    } else if (source.tokenType === ERC1948TYPE || source.tokenType === ERC721TYPE) {
      source.owner = to;
      return true;
    } else {
      return false;
    }
  }

  function ownerOf (color, tokenId) {
    return this.findToken({
      color: color,
      valueOrId: tokenId,
    }).owner || ZERO_ADDRESS;
  }

  function writeData (color, tokenId, newData) {
    const token = this.findToken({
      color: color,
      valueOrId: tokenId,
    });
    if (token) {
      token.data = newData;
    }
    return true;
  }

  function findToken (query) {
    const tokens = this.bag.filter(o => {
      return Object.entries(query).reduce((acc, [key, value]) => acc && (o[key] === value), true);
    });
    return tokens.length === 0 ? false : tokens[0];
  }

  tokenBag.balanceOf = balanceOf;
  tokenBag.readData = readData;
  tokenBag.ownerOf = ownerOf;
  tokenBag.findToken = findToken;
  tokenBag.writeData = writeData;
  tokenBag.transferFrom = transferFrom;
  return tokenBag;
}

module.exports = TokenBagHelpers;
