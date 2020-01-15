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
  ERC721TYPE
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
    const tokens = this.bag.filter(o => o.color === color && o.owner === address);
    return tokens.length === 0 ? 0 : tokens[0].valueOrId;
  }

  function readData (color, tokenId) {
    const tokens = this.bag.filter(o => o.color === color && o.valueOrId === tokenId);
    return tokens.length === 0 ? ZERO_HASH : tokens[0].data;
  }

  function transfer (color, from, to, value) {
    let source;

    this.bag.forEach(o => {
      if (o.color === color && o.owner === from) {
        source = o;
      }
    });
    if (!source) return false;
    if (bn(source.valueOrId).lt(bn(value))) return false;
    
    let dest;
    this.bag.forEach(o => {
      if (o.color === color && o.owner === to) {
        dest = o;
      }
    });

    if (!dest) {
      this.bag.forEach(o => {
        if (!dest && o.owner === ZERO_ADDRESS) {
          o.owner = to;
          o.color = color;
          dest = o;
        }
      });
    }

    if (!dest) return false;
    
    source.valueOrId = '0x' + bn(source.valueOrId).sub(bn(value)).toString(16, 64);
    dest.valueOrId = '0x' + bn(dest.valueOrId).add(bn(value)).toString(16, 64);
    return true;
  }

  tokenBag.balanceOf = balanceOf;
  tokenBag.readData = readData;
  tokenBag.transfer = transfer;
  return tokenBag;
}

module.exports = TokenBagHelpers;
