import { deployContract, deployCode } from './utils.js';
import { padUintArray } from './helpers/compactStateUtils.js';
import { ethers } from 'ethers';

const EthereumRuntime = artifacts.require('EthereumRuntime');
const CompactEthereumRuntime = artifacts.require('CompactEthereumRuntime');
const CompactProofMock = artifacts.require('CompactProofMock');
const CONST = require('./../utils/constants');
const HashZero = ethers.constants.HashZero;

let compactProofMock;
let ethRuntime;
let compactEthRuntime;

// eslint-disable-next-line max-len
function mockExecute ({ code, data, pc, stepCount, gasRemaining, gasLimit, stack, mem, accounts, accountsCode, logHash }) {
  return compactProofMock
    .mockExecute(
      {
        code: code || '0x',
        data: data || '0x',
        pc: pc | 0,
        errno: 0,
        stepCount: stepCount | 0,
        gasRemaining: gasRemaining || gasLimit || CONST.BLOCK_GAS_LIMIT,
        gasLimit: gasLimit || CONST.BLOCK_GAS_LIMIT,
        stack: stack || [],
        mem: mem || '0x',
        accounts: accounts || [],
        accountsCode: accountsCode || '0x',
        returnData: '0x',
        logHash: logHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
      }
    );
};

// eslint-disable-next-line max-len
function mockCompactExecute ({ code, data, pc, stepCount, gasRemaining, gasLimit, stack, mem, accounts, accountsCode, logHash }) {
  return compactProofMock
    .mockCompactExecute(
      {
        code: code || '0x',
        data: data || '0x',
        pc: pc | 0,
        errno: 0,
        stepCount: stepCount | 0,
        gasRemaining: gasRemaining || gasLimit || CONST.BLOCK_GAS_LIMIT,
        gasLimit: gasLimit || CONST.BLOCK_GAS_LIMIT,
        stack: stack || {
          size: 0,
          sibling: '0x0000000000000000000000000000000000000000000000000000000000000000',
          data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          datalength: 0,
        },
        mem: mem || '0x',
        accounts: accounts || [],
        accountsCode: accountsCode || '0x',
        returnData: '0x',
        logHash: logHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
      }
    );
};

contract('CompactProofBenchmark', function () {
  before(async () => {
    ethRuntime = await deployContract(EthereumRuntime);
    compactEthRuntime = await deployContract(CompactEthereumRuntime);
    compactProofMock = await deployContract(CompactProofMock, ethRuntime.address, compactEthRuntime.address);
  });

  describe('comparing gas usage', async () => {
    let code = '0x' + CONST.ADD;

    it('simple arithmetic', async () => {
      let stack = [5, 8];
      let compactStack = {
        size: 2,
        dataLength: 2,
        data: padUintArray([5, 8], 17),
        sibling: HashZero,
      };

      let codeContract = await deployCode([CONST.ADD]);
      let res = false;
      for (let i = 0; i < 1024; i++) {
        let tx = await mockExecute(
          {
            code: codeContract.address,
            stack,
            stepCount: 1,
          }
        );
        let gasCostFullStack = (await tx.wait()).gasUsed.toNumber();
        // console.log('With full stack', gasCostFullStack);

        // stackHash2 is result stack hash when submitting [5, 8] with stackSibling
        tx = await mockCompactExecute(
          {
            code,
            stack: compactStack,
            stepCount: 1,
          }
        );
        let gasCostCompactStack = (await tx.wait()).gasUsed.toNumber();
        // console.log('With compact stack', gasCostCompactStack);

        if (gasCostCompactStack < gasCostFullStack) {
          console.log('Compact Stack is economic with stack of size', i + 2);
          res = true;
          break;
        }
        stack.unshift(0);
        compactStack.size++;
      }
      if (!res) {
        assert.isTrue(false, 'Compact Stack is not economic at any size');
      }
    });
  });
});
