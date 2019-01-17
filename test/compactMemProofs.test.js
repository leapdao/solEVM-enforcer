import { extractMemElements, deployContract } from './utils';
import MerkleTree from './helpers/merkleTree';
import assertRevert from './helpers/assertRevert.js';

const OP = require('./helpers/constants');
const { BLOCK_GAS_LIMIT } = OP;

const EthereumRuntime = artifacts.require('EthereumRuntime.sol');
const CompactMemProofMock = artifacts.require('CompactMemoryProofsMock.sol');

contract('Compact Memory Proofs', function () {
  let ethRuntime;
  let compactMemProofVerifier;
  let result;

  let word = '0102030405060708010203040506070801020304050607080102030405060708';

  before(async () => {
    ethRuntime = await deployContract(EthereumRuntime);
    compactMemProofVerifier = await deployContract(CompactMemProofMock, ethRuntime.address);
  });

  it('should set the EthereumRuntime address correctly', async () => {
    assert.equal(await compactMemProofVerifier.ethRuntime(), ethRuntime.address);
  });

  it('should verify a MLOAD operation with a compact memory proof', async () => {
    const actualMemArray = '0x' + word.repeat(4);
    const elements = extractMemElements(actualMemArray);
    const memTree = new MerkleTree(elements);
    const compactMemProof = memTree.getProof(elements[1]);
    const memRoot = memTree.getRoot();

    const code = [OP.MLOAD];

    const preEVMImage = {
      code: `0x${code.join('')}`,
      data: '0x',
      pc: 0,
      errno: 0,
      stepCount: 0,
      gasRemaining: BLOCK_GAS_LIMIT,
      gasLimit: BLOCK_GAS_LIMIT,
      stack: [0x00],
      mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
      accounts: [],
      accountsCode: '0x',
      returnData: '0x',
      logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };

    result = await compactMemProofVerifier.verify(
      preEVMImage,
      compactMemProof,
      memRoot,
      3
    );

    assert.equal(result, true);
  });

  it('should fail to verify a MLOAD operation with a wrong compact memory proof', async () => {
    const actualMemArray = '0x' + word.repeat(4);

    const elements = extractMemElements(actualMemArray);
    const memTree = new MerkleTree(elements);
    const compactMemProof = [elements[0]];
    const memRoot = memTree.getRoot();

    const code = [OP.MLOAD];

    const preEVMImage = {
      code: `0x${code.join('')}`,
      data: '0x',
      pc: 0,
      errno: 0,
      stepCount: 0,
      gasRemaining: BLOCK_GAS_LIMIT,
      gasLimit: BLOCK_GAS_LIMIT,
      stack: [0x00],
      mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
      accounts: [],
      accountsCode: '0x',
      returnData: '0x',
      logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };

    result = await compactMemProofVerifier.verify(
      preEVMImage,
      compactMemProof,
      memRoot,
      3
    );

    assert.equal(result, false);
  });

  it('should revert if an operation accesses a memory element other than the leaf', async () => {
    const actualMemArray = '0x' + word.repeat(4);

    const elements = extractMemElements(actualMemArray);
    const memTree = new MerkleTree(elements);
    const compactMemProof = memTree.getProof(elements[1]);
    const memRoot = memTree.getRoot();

    const code = [OP.MLOAD];

    const preEVMImage = {
      code: `0x${code.join('')}`,
      data: '0x',
      pc: 0,
      errno: 0,
      stepCount: 0,
      gasRemaining: BLOCK_GAS_LIMIT,
      gasLimit: BLOCK_GAS_LIMIT,
      stack: [0x01],
      mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
      accounts: [],
      accountsCode: '0x',
      returnData: '0x',
      logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };

    assertRevert(compactMemProofVerifier.verify(
      preEVMImage,
      compactMemProof,
      memRoot,
      3
    ));
  });
});
