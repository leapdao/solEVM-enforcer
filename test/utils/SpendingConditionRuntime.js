'use strict';

const ethers = require('ethers');
const assert = require('assert');

const SpendingConditionRuntime = require('./../../utils/SpendingConditionRuntime');
const SpendingConditionMock = require('./../../build/contracts/SpendingConditionMock.json');

const UINT256_ZERO = ''.padStart(128, '0');
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_POW_2_32 = BigInt(4294967296);

/// @notice Supports the following functions:
///
/// ERC20
///   - balanceOf (owner)
///   - allowance (owner, spender)
///   - transfer (to, value)
///
/// ERC721
///   - getApproved (tokenId)
///   - ownerOf (tokenId)
///
/// ERC1948
///   - readData (tokenId)
///   - writeData (tokenId, newTokenData)
///
/// ERC1949:
///   - breed (tokenId, to, newTokenData)
///
/// ERC20, ERC721, ERC1948, ERC1949
///   - transferFrom (from, to, tokenId)
class Hofmann {
  static fromJSON (obj) {
    const ret = new this();
    const len = obj.length;

    for (let i = 0; i < len; i++) {
      const e = obj[i];
      const addr = e.address;
      let bag = e.isERC20 ? ret.erc20[addr] : ret.erc721[addr];

      if (!bag) {
        bag = {};
        if (e.isERC20) {
          ret.erc20[addr] = bag;
        } else {
          ret.erc721[addr] = bag;
        }
      }
      // index by owner for ERC20,
      // else index by value (tokenId)
      const t = {
        address: e.address,
        owner: e.owner,
        value: e.value,
        data: e.data,
        isApproved: e.isApproved,
        isERC20: e.isERC20 || false,
        isERC721: e.isERC721 || false,
        isERC1948: e.isERC1948 || false,
        isERC1949: e.isERC1949 || false,
      };
      if (e.isERC20) {
        bag[e.owner] = t;
      } else {
        bag[e.value] = t;
      }
    }

    return ret;
  }

  constructor () {
    this.erc20 = {};
    this.erc721 = {};
  }

  toJSON () {
    const ret = [];

    this._dumpBag(this.erc20, ret);
    this._dumpBag(this.erc721, ret);

    return ret;
  }

  _dumpBag (bag, ret) {
    const tokens = Object.keys(bag);
    const len = tokens.length;

    for (let i = 0; i < len; i++) {
      const array = bag[tokens[i]];
      for (let k in array) {
        const e = array[k];
        ret.push(Object.assign({}, e));
      }
    }
  }

  _isApprovedOrOwner (msgSender, token) {
    return token.owner === msgSender || token.isApproved;
  }

  /// @dev Checks if `addr` already exists in any token bag.
  hasToken (addr) {
    return (this.erc20[addr] || this.erc721[addr]) ? true : false;
  }

  /// @notice ERC20 only.
  /// @dev Assumes `target` exist in the token bag.
  /// If unsure check `hasToken(target)` first.
  balanceOf (target, owner) {
    const bag = this.erc20[target];
    const e = bag[owner];

    if (e) {
      return e.value;
    }
  }

  /// @notice ERC20 only.
  /// @dev Assumes `target` exist in the token bag.
  /// If unsure check `hasToken(target)` first.
  allowance (target, owner, spender) {
    const bag = this.erc20[target];
    const e = bag[owner];

    if (e) {
      return e.data;
    }
  }

  /// @notice ERC721, ERC1948, ERC1949  only.
  /// @dev Assumes `target` exist in the token bag.
  /// If unsure check `hasToken(target)` first.
  ownerOf (target, tokenId) {
    const bag = this.erc721[target];
    const e = bag[tokenId];

    if (e) {
      return e.owner.replace('0x', '').padStart(64, '0');
    }
  }

  /// @notice ERC721, ERC1948, ERC1949  only.
  /// @dev Assumes `target` exist in the token bag.
  /// If unsure check `hasToken(target)` first.
  getApproved (msgSender, target, tokenId) {
    const bag = this.erc721[target];
    const e = bag[tokenId];

    if (e) {
      if (e.isApproved) {
        return msgSender.replace('0x', '').padStart(64, '0');
      }

      return UINT256_ZERO;
    }
  }

  /// @notice ERC20 only.
  /// @dev Assumes `target` exist in the token bag.
  /// If unsure check `hasToken(target)` first.
  /// Question: check for ZERO address?
  transfer (msgSender, target, to, value) {
    const bag = this.erc20[target];
    const e = bag[msgSender];

    if (e) {
      const targetEntry= bag[to];
      const valueBigInt = BigInt(value);
      const has = BigInt(e.value);

      if (valueBigInt === BIGINT_ZERO) {
        return;
      }

      if (has >= valueBigInt) {
        e.value = `0x${(has - valueBigInt).toString(16).padStart(64, '0')}`;
        if (!targetEntry) {
          bag[to] = {
            address: target,
            owner: to,
            value: value,
            data: '0x0000000000000000000000000000000000000000000000000000000000000000',
            isERC20: true,
          };
        } else {
          targetEntry.value = `0x${(BigInt(targetEntry.value) + valueBigInt).toString(16).padStart(64, '0')}`;
        }

        return '0000000000000000000000000000000000000000000000000000000000000001';
      }
    }
  }

  /// @notice ERC20, ERC721, ERC1948, ERC1949 only.
  /// @dev Assumes `target` exist in the token bag.
  /// If unsure check `hasToken(target)` first.
  /// Question: check for ZERO address?
  transferFrom (msgSender, target, from, to, tokenId) {
    let bag = this.erc20[target];

    if (bag) {
      const e = bag[from];
      if (e) {
        const has = BigInt(e.value);
        const want = BigInt(tokenId);
        const allowance = BigInt(e.data);
        // not enough
        if (has < want || want > allowance || want === BIGINT_ZERO) {
          return;
        }
        e.data = `0x${(allowance - want).toString(16).padStart(64, '0')}`;
        e.value = `0x${(has - want).toString(16).padStart(64, '0')}`;

        // now update `to`
        const oldEntry = bag[to];
        if (oldEntry) {
          const val = BigInt(oldEntry.value) + BigInt(tokenId);
          oldEntry.value = `0x${val.toString(16).padStart(64, '0')}`;
        } else {
          bag[to] = {
            address: target,
            owner: to,
            value: tokenId,
            isERC20: true,
            data: '0x0000000000000000000000000000000000000000000000000000000000000000',
          };
        }
        return '0000000000000000000000000000000000000000000000000000000000000001';
      }
    } else {
      bag = this.erc721[target];
      const e = bag[tokenId];
      if (e && this._isApprovedOrOwner(msgSender, e)) {
        e.owner = to;
        e.isApproved = false;
        return '0000000000000000000000000000000000000000000000000000000000000001';
      }
    }
  }

  /// @notice ERC1948, ERC1949 only.
  /// @dev Assumes `target` exist in the token bag.
  /// If unsure check `hasToken(target)` first.
  readData (target, tokenId) {
    const bag = this.erc721[target];
    const e = bag[tokenId];

    if (e && (e.isERC1948 || e.isERC1949)) {
      return e.data;
    }
  }

  /// @notice ERC1948, ERC1949 only.
  /// @dev Assumes `target` exist in the token bag.
  /// If unsure check `hasToken(target)` first.
  writeData (msgSender, target, tokenId, newTokenData) {
    const bag = this.erc721[target];
    const e = bag[tokenId];

    if (e && (e.isERC1948 || e.isERC1949) && this._isApprovedOrOwner(msgSender, e)) {
      e.data = newTokenData;
      return '0000000000000000000000000000000000000000000000000000000000000001';
    }
  }

  /// @notice ERC1949 only.
  /// @dev Assumes `target` exist in the token bag.
  /// If unsure check `hasToken(target)` first.
  breed (msgSender, target, tokenId, to, newTokenData) {
    const bag = this.erc721[target];
    const e = bag[tokenId];

    // TODO "sender not queen owner nor approved"
    // XXX: How do we signal that the token is a Queen?...
    if (e && e.isERC1949 && this._isApprovedOrOwner(msgSender, e)) {
      // uint256 counter = uint256(readData(_queenId));
      const counter = BigInt(e.data);
      // require(counter > 0, "queenId too low");
      // require(counter < 4294967296, "queenId too high");  // 2 ^ 32 = 4294967296
      if (counter < BIGINT_ZERO || counter > BIGINT_POW_2_32) {
        return;
      }
      // writeData(_queenId, bytes32(counter + 1));
      e.data = `0x${(counter + BIGINT_ONE).toString(16).padStart(64, '0')}`;
      // uint256 newId = uint256(keccak256(abi.encodePacked(_queenId, counter)));
      const newId = ethers.utils.solidityKeccak256(['uint256', 'bytes32'], [target, e.data]);
      // mint
      bag[newId] = {
        address: target,
        owner: to,
        value: newId,
        data: newTokenData,
      };
      // returns nothing
      return '';
    }
  }
}

describe('SpendingConditionRuntime', function () {
  const TOKEN = '0x0101010101010101010101010101010101010101';
  const ALICE = '0x1111111111111111111111111111111111111111';
  const BOB = '0x2222222222222222222222222222222222222222';

  const spendingCondition = new ethers.utils.Interface(SpendingConditionMock.abi);
  const code = SpendingConditionMock.deployedBytecode;

  it('should fail with empty hofmann struct', async () => {
    const runtime = new SpendingConditionRuntime();
    const customEnvironment = Hofmann.fromJSON([]);
    const data = spendingCondition.functions.test.encode(
      [TOKEN, [ALICE, BOB], ['0xfa', '0xff']]
    );
    const state = await runtime.run({ code, data, customEnvironment });

    assert.equal(state.opName, 'REVERT', 'should revert');
  });

  it('test ERC20', async () => {
    const runtime = new SpendingConditionRuntime();
    const value = '0x00000000000000000000000000000000000000000000000000000000000000ff';
    let customEnvironment = Hofmann.fromJSON([
      {
        address: TOKEN,
        owner: ALICE,
        value: value,
        isERC20: true,
        data: '0x00000000000000000000000000000000000000000000000000000000000000fa',
      },
      {
        address: TOKEN,
        // the contract
        owner: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
        value: value,
        isERC20: true,
        data: '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
    ]);
    const copy = customEnvironment.toJSON();
    const data = spendingCondition.functions.testERC20.encode(
      [TOKEN, ALICE, BOB, value]
    );
    const state = await runtime.run({ code, data, customEnvironment });

    assert.equal(state.opName, 'STOP', 'should STOP');
    // value - allowance + value from contract
    // (0xff - 0xfa + 0xff - 1)
    copy[0].value = copy[0].value.replace('00ff', '0103');
    copy[0].data = copy[0].data.replace('fa', '00');
    copy[1].value = copy[1].value.replace('ff', '00');
    copy[2] = {
      address: TOKEN,
      owner: BOB,
      value: value.replace('ff', 'fa'),
      isERC20: true,
      data: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };
    copy[3] = {
      address: TOKEN,
      owner: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec5',
      value: value.replace('ff', '01'),
      isERC20: true,
      data: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };
    assert.deepEqual(state.customEnvironment.toJSON(), copy, 'hofmann struct should be correct');
  });

  it('test ERC20 - no allowance', async () => {
    const runtime = new SpendingConditionRuntime();
    const value = '0x00000000000000000000000000000000000000000000000000000000000000ff';
    let customEnvironment = Hofmann.fromJSON([
      {
        address: TOKEN,
        owner: ALICE,
        value: value,
        isERC20: true,
        data: '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
      {
        address: TOKEN,
        // the contract
        owner: '0x0f572e5295c57f15886f9b263e2f6d2d6c7b5ec6',
        value: value,
        isERC20: true,
        data: '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
    ]);
    const data = spendingCondition.functions.testERC20.encode(
      [TOKEN, ALICE, BOB, value]
    );
    const state = await runtime.run({ code, data, customEnvironment });

    assert.equal(state.opName, 'REVERT', 'should REVERT');
  });


  it('test ERC721', async () => {
    const runtime = new SpendingConditionRuntime();
    const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const customEnvironment = Hofmann.fromJSON([
      {
        address: TOKEN,
        owner: ALICE,
        value: tokenId,
        isERC721: true,
        isApproved: true,
      },
    ]);
    const copy = customEnvironment.toJSON();
    const data = spendingCondition.functions.testERC721.encode(
      [TOKEN, ALICE, BOB, tokenId]
    );
    const state = await runtime.run({ code, data, customEnvironment });

    assert.equal(state.opName, 'STOP', 'should STOP');
    copy[0].owner = BOB;
    copy[0].isApproved = false;
    assert.deepEqual(state.customEnvironment.toJSON(), copy, 'hofmann struct should be correct');
  });

  it('test ERC1948', async () => {
    const runtime = new SpendingConditionRuntime();
    const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const customEnvironment = Hofmann.fromJSON([
      {
        address: TOKEN,
        owner: ALICE,
        value: tokenId,
        data: '0x0000000000000000000000000000000000000000000000000000000000000001',
        isERC1948: true,
        isApproved: true,
      },
    ]);
    const copy = customEnvironment.toJSON();
    const data = spendingCondition.functions.testERC1948.encode(
      [TOKEN, ALICE, BOB, tokenId]
    );
    const state = await runtime.run({ code, data, customEnvironment });

    assert.equal(state.opName, 'STOP', 'should STOP');
    copy[0].data = copy[0].data.replace('01', '02');
    assert.deepEqual(state.customEnvironment.toJSON(), copy, 'hofmann struct should be correct');
  });

  it('test ERC1948 - wrong tokenId', async () => {
    const runtime = new SpendingConditionRuntime();
    const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const customEnvironment = Hofmann.fromJSON([
      {
        address: TOKEN,
        owner: ALICE,
        value: tokenId,
        data: '0x0000000000000000000000000000000000000000000000000000000000000001',
        isERC1948: true,
        isApproved: true,
      },
    ]);
    const data = spendingCondition.functions.testERC1948.encode(
      [TOKEN, ALICE, BOB, tokenId.replace('01', '02')]
    );
    const state = await runtime.run({ code, data, customEnvironment });

    assert.equal(state.opName, 'REVERT', 'should REVERT');
  });

  it('test ERC1948 - not owner and not approved', async () => {
    const runtime = new SpendingConditionRuntime();
    const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const customEnvironment = Hofmann.fromJSON([
      {
        address: TOKEN,
        owner: ALICE,
        value: tokenId,
        data: '0x0000000000000000000000000000000000000000000000000000000000000001',
        isERC1948: true,
        isApproved: false,
      },
    ]);
    const data = spendingCondition.functions.testERC1948.encode(
      [TOKEN, ALICE, BOB, tokenId.replace('01', '02')]
    );
    const state = await runtime.run({ code, data, customEnvironment });

    assert.equal(state.opName, 'REVERT', 'should REVERT');
  });

  it('test ERC1949', async () => {
    const runtime = new SpendingConditionRuntime();
    const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const customEnvironment = Hofmann.fromJSON([
      // queen
      {
        address: TOKEN,
        owner: ALICE,
        value: tokenId,
        data: '0x0000000000000000000000000000000000000000000000000000000000000001',
        isERC1949: true,
        isApproved: true,
      },
    ]);
    const copy = customEnvironment.toJSON();
    const data = spendingCondition.functions.testERC1949.encode(
      [TOKEN, ALICE, BOB, tokenId]
    );
    const state = await runtime.run({ code, data, customEnvironment });

    assert.equal(state.opName, 'STOP', 'should STOP');
    copy[0].data = copy[0].data.replace('01', '02');
    // worker
    copy[1] = {
      address: TOKEN,
      owner: BOB,
      value: '0xd2869508550c71a0ebfe05ddd28ce832b357803f6f387154b1a5451da28aca19',
      data: '0x000000000000000000000000000000000000000000000000000000000000000a',
    };
    assert.deepEqual(state.customEnvironment.toJSON(), copy, 'hofmann struct should be correct');
  });

  it('test ERC1949 - wrong tokenId', async () => {
    const runtime = new SpendingConditionRuntime();
    const tokenId = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const customEnvironment = Hofmann.fromJSON([
      // queen
      {
        address: TOKEN,
        owner: ALICE,
        value: tokenId,
        data: '0x0000000000000000000000000000000000000000000000000000000000000001',
        isApproved: true,
        isERC1949: true,
      },
    ]);
    const data = spendingCondition.functions.testERC1949.encode(
      [TOKEN, ALICE, BOB, tokenId.replace('01', '02')]
    );
    const state = await runtime.run({ code, data, customEnvironment });

    assert.equal(state.opName, 'REVERT', 'should REVERT');
  });
});
