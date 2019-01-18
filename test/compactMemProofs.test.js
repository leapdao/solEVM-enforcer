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

  describe('setup', () => {
    it('should set the EthereumRuntime address correctly', async () => {
      assert.equal(await compactMemProofVerifier.ethRuntime(), ethRuntime.address);
    });
  });

  describe('MLOAD', () => {
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

      result = await compactMemProofVerifier.verifyMload(
        preEVMImage,
        compactMemProof,
        memRoot,
        1
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

      result = await compactMemProofVerifier.verifyMload(
        preEVMImage,
        compactMemProof,
        memRoot,
        1
      );

      assert.equal(result, false);
    });

    it('should revert a MLOAD operation if it accesses a memory element other than the leaf', async () => {
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

      assertRevert(compactMemProofVerifier.verifyMload(
        preEVMImage,
        compactMemProof,
        memRoot,
        3
      ));
    });
  });

  describe('MLOAD', () => {
    it('should verify a MSTORE operation with a correct compact memory proof', async () => {
      const actualMemArray = '0x' + word.repeat(4);

      const elements = extractMemElements(actualMemArray);
      const memTree = new MerkleTree(elements);
      const compactMemProof = memTree.getProof(elements[1]);
      const previousMemRoot = memTree.getRoot();

      const code = [OP.MSTORE];

      const expectedMemOutput = '0x0000000000000000000000000000000000000000000000000000000000005567';
      elements[1] = expectedMemOutput;
      const newMemTree = new MerkleTree(elements);
      const newMemRoot = newMemTree.getRoot();

      const preEVMImage = {
        code: `0x${code.join('')}`,
        data: '0x',
        pc: 0,
        errno: 0,
        stepCount: 0,
        gasRemaining: BLOCK_GAS_LIMIT,
        gasLimit: BLOCK_GAS_LIMIT,
        stack: [parseInt('0x5567', 16), 0],
        mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
        accounts: [],
        accountsCode: '0x',
        returnData: '0x',
        logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      };

      result = await compactMemProofVerifier.verifyMstore(
        preEVMImage,
        compactMemProof,
        previousMemRoot,
        newMemRoot,
        1
      );

      assert.equal(result, true);
    });

    it('should fail to verify a MSTORE operation with an incorrect compact memory proof', async () => {
      const actualMemArray = '0x' + word.repeat(4);

      const elements = extractMemElements(actualMemArray);
      const memTree = new MerkleTree(elements);
      const compactMemProof = memTree.getProof(elements[1]);
      const previousMemRoot = memTree.getRoot();

      const code = [OP.MSTORE];

      const newMemRoot = elements[1];

      const preEVMImage = {
        code: `0x${code.join('')}`,
        data: '0x',
        pc: 0,
        errno: 0,
        stepCount: 0,
        gasRemaining: BLOCK_GAS_LIMIT,
        gasLimit: BLOCK_GAS_LIMIT,
        stack: [parseInt('0x5567', 16), 0],
        mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
        accounts: [],
        accountsCode: '0x',
        returnData: '0x',
        logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      };

      result = await compactMemProofVerifier.verifyMstore(
        preEVMImage,
        compactMemProof,
        previousMemRoot,
        newMemRoot,
        1
      );

      assert.equal(result, false);
    });

    it('should throw if an MSTORE operation does not include a correct initial compact memory proof', async () => {
      const actualMemArray = '0x' + word.repeat(4);

      const elements = extractMemElements(actualMemArray);
      const memTree = new MerkleTree(elements);
      const compactMemProof = [elements[0], elements[1]];
      const previousMemRoot = memTree.getRoot();

      const code = [OP.MSTORE];

      const expectedMemOutput = '0x0000000000000000000000000000000000000000000000000000000000005567';
      elements[1] = expectedMemOutput;
      const newMemTree = new MerkleTree(elements);
      const newMemRoot = newMemTree.getRoot();

      const preEVMImage = {
        code: `0x${code.join('')}`,
        data: '0x',
        pc: 0,
        errno: 0,
        stepCount: 0,
        gasRemaining: BLOCK_GAS_LIMIT,
        gasLimit: BLOCK_GAS_LIMIT,
        stack: [parseInt('0x5567', 16), 0],
        mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
        accounts: [],
        accountsCode: '0x',
        returnData: '0x',
        logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      };

      assertRevert(compactMemProofVerifier.verifyMstore(
        preEVMImage,
        compactMemProof,
        previousMemRoot,
        newMemRoot,
        1
      ));
    });

    it('should throw if an MSTORE operation accesses a memory element other than the leaf', async () => {
      const actualMemArray = '0x' + word.repeat(4);

      const elements = extractMemElements(actualMemArray);
      const memTree = new MerkleTree(elements);
      const compactMemProof = memTree.getProof(elements[1]);
      const previousMemRoot = memTree.getRoot();

      const code = [OP.MSTORE];

      const expectedMemOutput = '0x0000000000000000000000000000000000000000000000000000000000005567';
      elements[1] = expectedMemOutput;
      const newMemTree = new MerkleTree(elements);
      const newMemRoot = newMemTree.getRoot();

      const preEVMImage = {
        code: `0x${code.join('')}`,
        data: '0x',
        pc: 0,
        errno: 0,
        stepCount: 0,
        gasRemaining: BLOCK_GAS_LIMIT,
        gasLimit: BLOCK_GAS_LIMIT,
        stack: [parseInt('0x5567', 16), 1],
        mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
        accounts: [],
        accountsCode: '0x',
        returnData: '0x',
        logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      };

      assertRevert(compactMemProofVerifier.verifyMstore(
        preEVMImage,
        compactMemProof,
        previousMemRoot,
        newMemRoot,
        1
      ));
    });
  });

  describe('MSTORE8', () => {
    it('should verify a MSTORE8 operation with a correct compact memory proof', async () => {
      const actualMemArray = '0x' + word.repeat(4);

      const elements = extractMemElements(actualMemArray);
      const memTree = new MerkleTree(elements);
      const compactMemProof = memTree.getProof(elements[1]);
      const previousMemRoot = memTree.getRoot();

      const code = [OP.MSTORE8];

      const expectedMemOutput = '0x0167030405060708010203040506070801020304050607080102030405060708';
      elements[1] = expectedMemOutput;
      const newMemTree = new MerkleTree(elements);
      const newMemRoot = newMemTree.getRoot();

      const preEVMImage = {
        code: `0x${code.join('')}`,
        data: '0x',
        pc: 0,
        errno: 0,
        stepCount: 0,
        gasRemaining: BLOCK_GAS_LIMIT,
        gasLimit: BLOCK_GAS_LIMIT,
        stack: [parseInt('0x5567', 16), 1],
        mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
        accounts: [],
        accountsCode: '0x',
        returnData: '0x',
        logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      };

      result = await compactMemProofVerifier.verifyMstore(
        preEVMImage,
        compactMemProof,
        previousMemRoot,
        newMemRoot,
        1
      );

      assert.equal(result, true);
    });

    it('should fail to verify a MSTORE8 operation with an incorrect compact memory proof', async () => {
      const actualMemArray = '0x' + word.repeat(4);

      const elements = extractMemElements(actualMemArray);
      const memTree = new MerkleTree(elements);
      const compactMemProof = memTree.getProof(elements[1]);
      const previousMemRoot = memTree.getRoot();

      const code = [OP.MSTORE8];

      const newMemRoot = elements[1];

      const preEVMImage = {
        code: `0x${code.join('')}`,
        data: '0x',
        pc: 0,
        errno: 0,
        stepCount: 0,
        gasRemaining: BLOCK_GAS_LIMIT,
        gasLimit: BLOCK_GAS_LIMIT,
        stack: [parseInt('0x5567', 16), 1],
        mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
        accounts: [],
        accountsCode: '0x',
        returnData: '0x',
        logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      };

      result = await compactMemProofVerifier.verifyMstore(
        preEVMImage,
        compactMemProof,
        previousMemRoot,
        newMemRoot,
        1
      );

      assert.equal(result, false);
    });

    it('should throw if an MSTORE8 operation does not include a correct initial compact memory proof', async () => {
      const actualMemArray = '0x' + word.repeat(4);

      const elements = extractMemElements(actualMemArray);
      const memTree = new MerkleTree(elements);
      const compactMemProof = [elements[0], elements[1]];
      const previousMemRoot = memTree.getRoot();

      const code = [OP.MSTORE8];

      const expectedMemOutput = '0x0167030405060708010203040506070801020304050607080102030405060708';
      elements[1] = expectedMemOutput;
      const newMemTree = new MerkleTree(elements);
      const newMemRoot = newMemTree.getRoot();

      const preEVMImage = {
        code: `0x${code.join('')}`,
        data: '0x',
        pc: 0,
        errno: 0,
        stepCount: 0,
        gasRemaining: BLOCK_GAS_LIMIT,
        gasLimit: BLOCK_GAS_LIMIT,
        stack: [parseInt('0x5567', 16), 1],
        mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
        accounts: [],
        accountsCode: '0x',
        returnData: '0x',
        logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      };

      assertRevert(compactMemProofVerifier.verifyMstore(
        preEVMImage,
        compactMemProof,
        previousMemRoot,
        newMemRoot,
        1
      ));
    });

    it('should throw if an MSTORE8 operation accesses a memory element other than the leaf', async () => {
      const actualMemArray = '0x' + word.repeat(4);

      const elements = extractMemElements(actualMemArray);
      const memTree = new MerkleTree(elements);
      const compactMemProof = memTree.getProof(elements[1]);
      const previousMemRoot = memTree.getRoot();

      const code = [OP.MSTORE8];

      const expectedMemOutput = '0x0167030405060708010203040506070801020304050607080102030405060708';
      elements[1] = expectedMemOutput;
      const newMemTree = new MerkleTree(elements);
      const newMemRoot = newMemTree.getRoot();

      const preEVMImage = {
        code: `0x${code.join('')}`,
        data: '0x',
        pc: 0,
        errno: 0,
        stepCount: 0,
        gasRemaining: BLOCK_GAS_LIMIT,
        gasLimit: BLOCK_GAS_LIMIT,
        stack: [parseInt('0x5567', 16), 33],
        mem: '0x0102030405060708010203040506070801020304050607080102030405060708',
        accounts: [],
        accountsCode: '0x',
        returnData: '0x',
        logHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      };

      assertRevert(compactMemProofVerifier.verifyMstore(
        preEVMImage,
        compactMemProof,
        previousMemRoot,
        newMemRoot,
        1
      ));
    });
  });
});
