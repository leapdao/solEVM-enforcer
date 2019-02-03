import { deployContract } from './../helpers/utils.js';
import { hashUint256Array, hashSibling, hashStack } from './../helpers/hash.js';
import { padUintArray } from './../helpers/compactState.js';
import { ethers } from 'ethers';

// import assertInvalid from './../helpers/assertInvalid.js';
import assertRevert from './../helpers/assertRevert.js';
import Runtime from './../helpers/compactRuntimeAdapter';

const EthereumRuntime = artifacts.require('CompactEthereumRuntime');
const CONST = require('./../../utils/constants');
const HashZero = ethers.constants.HashZero;
const assertReject = require('assert').rejects;

contract('CompactRuntimeProof', function () {
  let rt;

  before(async () => {
    rt = new Runtime(await deployContract(EthereumRuntime));
  });

  describe('can use compact stack proof', async () => {
    let code = '0x' + CONST.ADD;
    let stack = {
      size: 5,
      dataLength: 5,
      data: padUintArray([1, 2, 3, 5, 8], 17),
      sibling: HashZero,
    };

    it('verify correct stack proof', async () => {
      // stackHash1 is result stack hash when submitting full stack
      let evmImageAfter1 = await rt.execute(
        {
          code: code,
          stack: stack,
          stepCount: 1,
        }
      );
      // stack.sibling is hash of [1, 2, 3]
      let compactStack = {
        size: 5,
        dataLength: 2,
        data: padUintArray([5, 8], 17),
        sibling: hashSibling([1, 2, 3]),
      };
      // stackHash2 is result stack hash when submitting [5, 8] with stackSibling
      let evmImageAfter2 = await rt.execute(
        {
          code: code,
          stack: compactStack,
          stepCount: 1,
        }
      );
      assert.equal(hashStack(evmImageAfter1.stack), hashStack(evmImageAfter2.stack), 'stack hash should be the same');
    });

    it('revert when stack not enough', async () => {
      // geth seems to just return a 'call exception'
      // assertInvalid(rt.execute(
      await assertReject(rt.execute(
        {
          code,
          stack: {
            size: 5,
            dataLength: 1,
            data: padUintArray([8], 17),
            sibling: HashZero,
          },
          stepCount: 1,
        }
      ));
    });

    it('revert when stack overflow', async () => {
      assertRevert(rt.execute(
        {
          code: '0x' + CONST.PUSH1 + '01',
          stack: {
            size: 1024,
            dataLength: 0,
            data: padUintArray([], 17),
            sibling: HashZero,
          },
          stepCount: 1,
        }
      ));
    });

    it('verify incorrect stack proof', async () => {
      // stackHash1 is result stack hash when submitting full stack
      let evmImageAfter1 = await rt.execute(
        {
          code,
          stack,
          stepCount: 1,
        }
      );

      // stack.sibling is hash of [1, 2, 4]
      let compactStack = {
        size: 5,
        dataLength: 2,
        data: padUintArray([5, 8], 17),
        sibling: hashUint256Array([1, 2, 4], 3, HashZero),
      };
      // stackHash2 is result stack hash when submitting [5, 8] with incorrect sibling
      let evmImageAfter2 = await rt.execute(
        {
          code: code,
          stack: compactStack,
          stepCount: 1,
        }
      );
      assert.notEqual(
        hashStack(evmImageAfter1.stack),
        hashStack(evmImageAfter2.stack),
        'stack hash should not be the same'
      );
    });
  });
});
