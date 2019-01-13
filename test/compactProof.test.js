// import { deployContract } from './utils.js';
// import { hashUint256Array } from './helpers/hash.js';
// import assertRevert from './helpers/assertRevert.js';
// const CompactProofMock = artifacts.require('CompactProofMock');
// const EthereumRuntime = artifacts.require('EthereumRuntime');
// const CONST = require('./helpers/constants');
// const EMPTY_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000';

// contract('CompactProofMock', function () {
//   let compactProof;
//   let ethRuntime;
//   before(async () => {
//     ethRuntime = await deployContract(EthereumRuntime);
//     compactProof = await deployContract(CompactProofMock, ethRuntime.address);
//   });

//   describe('can use compact stack proof', async () => {
//     let code = '0x' + CONST.ADD;
//     let params = [0, 1, CONST.BLOCK_GAS_LIMIT, CONST.BLOCK_GAS_LIMIT];
//     let stack = [1, 2, 3, 5, 8];

//     it('verify correct stack proof', async () => {
//       // stackHash1 is result stack hash when submitting full stack
//       let stackHash1 = await compactProof.executeStackHash(code, params, stack, EMPTY_HASH);
//       // stackSibling is hash of [1, 2, 3]
//       let stackSibling = hashUint256Array(stack.slice(0, 3), 0);
//       // stackHash2 is result stack hash when submitting [5, 8] with stackSibling
//       let stackHash2 = await compactProof.executeStackHash(code, params, stack.slice(-2), stackSibling);
//       assert.equal(stackHash1, stackHash2, 'stack hash should be the same');
//     });

//     it('revert when stack not enough', () => {
//       assertRevert(
//         compactProof.executeStackHash(code, params, stack.slice(-1), hashUint256Array(stack.slice(0, 4), 0))
//       );
//     });

//     it('verify incorrect stack proof', async () => {
//       let stackHash1 = await compactProof.executeStackHash(code, params, stack, EMPTY_HASH);
//       // incorrect stack sibling
//       let stackHash2 = await compactProof.executeStackHash(code, params, stack.slice(-2), EMPTY_HASH);
//       assert.notEqual(stackHash1, stackHash2, 'stack hash should not match');
//     });
//   });
// });
