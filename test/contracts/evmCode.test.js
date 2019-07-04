const { deployContract } = require('./../helpers/utils');
const BN = require('ethers').utils.BigNumber;
const EVMCodeMock = artifacts.require('EVMCodeMock.sol');
const assert = require('assert');

contract('TestEVMCode', function () {
  let evmCode;

  before(async () => {
    evmCode = await deployContract(EVMCodeMock);
  });

  const rawCodes = [
    {
      pos: 0,
      value: '0x7f10111213141516171819202122232425262728293031323334353637383940',
    },
    {
      pos: 1,
      value: '0x4100000000000000000000000000000000000000000000000000000000000000',
    },
  ];

  it('test findFragment #1', async function () {
    let res = await evmCode.testFindFragment(
      rawCodes,
      2,
      64,
      0
    );
    assert.equal(res.pos, 0);
    assert(res.value.eq(new BN('0x7f10111213141516171819202122232425262728293031323334353637383940')));
  });

  it('test findFragment #2', async function () {
    let res = await evmCode.testFindFragment(
      rawCodes,
      2,
      64,
      1
    );
    assert.equal(res.pos, 1);
    assert(res.value.eq(new BN('0x4100000000000000000000000000000000000000000000000000000000000000')));
  });

  it('test to uint #1', async function () {
    let res = await evmCode.testToUint(
      [
        {
          pos: 0,
          value: '0x7f10111213141516171819202122232425262728293031323334353637383940',
        },
        {
          pos: 1,
          value: '0x4100000000000000000000000000000000000000000000000000000000000000',
        },
      ],
      2,
      33,
      1,
      32
    );
    assert(res.eq('0x01011121314151617181920212223242526272829303132333435363738394041'));
  });

  it('test to uint #2', async function () {
    let res = await evmCode.testToUint(
      [
        {
          pos: 0,
          value: '0x7f10111213141516171819202122232425262728293031323334353637383940',
        },
        {
          pos: 1,
          value: '0x4100000000000000000000000000000000000000000000000000000000000000',
        },
      ],
      2,
      33,
      1,
      32
    );
    assert(res.eq('0x01011121314151617181920212223242526272829303132333435363738394041'));
  });
});
