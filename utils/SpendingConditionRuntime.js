'use strict';

const EVMRuntime = require('./EVMRuntime');
const HydratedRuntime = require('./HydratedRuntime');

const VM = require('ethereumjs-vm');
const BN = VM.deps.ethUtil.BN;
const ethers = require('ethers');

const FUNC_SIG_BALANCE_OF = '70a08231';
const FUNC_SIG_TRANSFER = 'a9059cbb';
const FUNC_SIG_TRANSFER_FROM = '23b872dd';
const FUNC_SIG_OWNER_OF = '6352211e';
const FUNC_SIG_GET_APPROVED = '081812fc';
const FUNC_SIG_ALLOWANCE = 'dd62ed3e';
const FUNC_SIG_READ_DATA = '37ebbc03';
const FUNC_SIG_WRITE_DATA = 'a983d43f';
const FUNC_SIG_BREED = '451da9f9';

// TODO: replace with memLoad
function loadAndPad (runState, offset, len) {
  let ret = '';
  for (let i = offset; i < offset + len; i++) {
    let val = runState.memory[i] || 0;
    ret += val.toString(16).padStart(2, '0');
  }

  return ret;
}

/*
 Spending Conditions

 Supported token standards:
   - ERC20
   - ERC721
   - ERC1948
   - ERC1949

 Constraints:
   - ..
 
 Inputs:
   - first input is always used for gas.
 */
module.exports = class SpendingConditionRuntime extends EVMRuntime {
  async initRunState (obj) {
    const runState = await super.initRunState(obj);

    runState.customEnvironment = obj.customEnvironment;

    return runState;
  }

  async handleEXTCODESIZE (runState) {
    const addr = `0x${runState.stack.pop().toString(16).padStart(40, '0')}`;
    if (runState.customEnvironment.hasToken(addr)) {
      runState.stack.push(new BN(1));
      return;
    }

    runState.stack.push(new BN(0));
  }

  async interceptCall (runState, target, data) {
    const hofmann = runState.customEnvironment;

    if (!hofmann.hasToken(target)) {
      return;
    }

    let offset = 0;
    const funcSig = data.substring(offset, offset += 8);
    const msgSender = `0x${runState.address.toString('hex')}`;

    if (funcSig === FUNC_SIG_BALANCE_OF) {
      const owner = `0x${data.substring(offset += 24, offset += 40)}`;

      return hofmann.balanceOf(target, owner);
    }

    if (funcSig === FUNC_SIG_ALLOWANCE) {
      const owner = '0x' + data.substring(offset += 24, offset += 40);
      const spender = '0x' + data.substring(offset += 24, offset += 40);

      return hofmann.allowance(target, owner, spender);
    }

    if (funcSig === FUNC_SIG_OWNER_OF) {
      const tokenId = '0x' + data.substring(offset, offset += 64);

      return hofmann.ownerOf(target, tokenId);
    }

    if (funcSig === FUNC_SIG_GET_APPROVED) {
      const tokenId = '0x' + data.substring(offset, offset += 64);

      return hofmann.getApproved('0x' + runState.address.toString('hex'), target, tokenId);
    }

    if (funcSig === FUNC_SIG_TRANSFER) {
      const to = '0x' + data.substring(offset += 24, offset += 40);
      const value = '0x' + data.substring(offset, offset += 64);

      return hofmann.transfer(msgSender, target, to, value);
    }

    if (funcSig === FUNC_SIG_TRANSFER_FROM) {
      const from = '0x' + data.substring(offset += 24, offset += 40);
      const to = '0x' + data.substring(offset += 24, offset += 40);
      const tokenId = '0x' + data.substring(offset, offset += 64);

      return hofmann.transferFrom(msgSender, target, from, to, tokenId);
    }

    if (funcSig === FUNC_SIG_READ_DATA) {
      const tokenId = '0x' + data.substring(offset, offset += 64);

      return hofmann.readData(target, tokenId);
    }

    if (funcSig === FUNC_SIG_WRITE_DATA) {
      const tokenId = '0x' + data.substring(offset, offset += 64);
      const newTokenData = '0x' + data.substring(offset, offset += 64);

      return hofmann.writeData(msgSender, target, tokenId, newTokenData);
    }

    if (funcSig === FUNC_SIG_BREED) {
      const tokenId = '0x' + data.substring(offset, offset += 64);
      const to = '0x' + data.substring(offset += 24, offset += 40);
      const newTokenData = '0x' + data.substring(offset, offset += 64);

      return hofmann.breed(msgSender, target, tokenId, to, newTokenData);
    }
  }

  async handleCALL (runState) {
    const gas = runState.stack.pop();
    const starget = '0x' + runState.stack.pop().toString(16).padStart(40, '0');
    const value = runState.stack.pop();
    const inOffset = runState.stack.pop().toNumber();
    const inSize = runState.stack.pop().toNumber();
    const retOffset = runState.stack.pop().toNumber();
    const retSize = runState.stack.pop().toNumber();
    const data = loadAndPad(runState, inOffset, inSize);

    // TODO: account for memory gas costs
    const retData = await this.interceptCall(runState, starget, data);
    if (typeof retData === 'string') {
      // store data
      runState.lastReturned = Buffer.from(retData, 'hex');
      runState.stack.push(new BN(1));
      for (let i = 0; i < retSize; i++) {
        const val = runState.lastReturned[i] || 0;
        runState.memory[retOffset + i] = val;
      }
    } else {
      runState.lastReturned = Buffer.alloc(0);
      runState.stack.push(new BN(0));
    }
  }

  async handleSTATICCALL (runState) {
    // skip for precompiles
    const _target = runState.stack[runState.stack.length - 2];
    if (_target.gten(0) && _target.lten(8)) {
      return super.handleSTATICCALL(runState);
    }

    const gas = runState.stack.pop();
    const target = `0x${runState.stack.pop().toString(16).padStart(40, '0')}`;
    const inOffset = runState.stack.pop().toNumber();
    const inSize = runState.stack.pop().toNumber();
    const retOffset = runState.stack.pop().toNumber();
    const retSize = runState.stack.pop().toNumber();
    const data = loadAndPad(runState, inOffset, inSize);

    // TODO: account for memory gas costs
    const retData = await this.interceptCall(runState, target, data);
    if (typeof retData === 'string') {
      runState.lastReturned = Buffer.from(retData.replace('0x', ''), 'hex');
      for (let i = 0; i < retSize; i++) {
        const val = runState.lastReturned[i] || 0;
        runState.memory[retOffset + i] = val;
      }
      runState.stack.push(new BN(1));
    } else {
      runState.lastReturned = Buffer.alloc(0);
      runState.stack.push(new BN(0));
    }
  }
};
