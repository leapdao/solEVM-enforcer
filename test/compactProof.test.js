import { deployContract } from './utils.js';
import { hashUint256Array, hashStack } from './helpers/hash.js';
import { padUintArray } from './helpers/compactState.js';

import assertInvalid from './helpers/assertInvalid.js';
import Runtime from './helpers/compactRuntimeAdapter';

const EthereumRuntime = artifacts.require('CompactEthereumRuntime');
const CONST = require('./helpers/constants');
const EMPTY_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

contract('CompactProofMock', function () {
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
      sibling: EMPTY_HASH,
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
        sibling: hashUint256Array([1, 2, 3], 0),
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
      assertInvalid(rt.execute(
        {
          code,
          stack: {
            size: 5,
            dataLength: 1,
            data: padUintArray([8], 17),
            sibling: EMPTY_HASH,
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
        sibling: hashUint256Array([1, 2, 4], 0),
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
