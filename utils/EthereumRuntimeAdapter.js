const { BLOCK_GAS_LIMIT } = require('./constants');
const ethers = require('ethers');

module.exports = class EthereumRuntimeAdapter {
  constructor (runtimeContract) {
    // explicit mark it as view, so we can just call the execute function
    // TODO: ethers.js should provide the option to explicitly call a function
    // https://github.com/ethers-io/ethers.js/issues/395

    // Need to copy (read-only)
    let abi = JSON.parse(JSON.stringify(runtimeContract.interface.abi));

    abi[0].constant = true;
    abi[0].stateMutability = 'view';

    this.runtimeContract = new ethers.Contract(
      runtimeContract.address,
      abi,
      runtimeContract.provider
    );
    // this is used to derive the gas usage (payable)
    this.payableRuntimeContract = runtimeContract;
  }

  execute (
    { code, codeFragLength, codeLength, data, pc, stepCount, gasRemaining, gasLimit, stack, mem },
    payable
  ) {
    return (payable ? this.payableRuntimeContract.execute : this.runtimeContract.execute)(
      {
        code,
        codeFragLength,
        codeLength,
        data: data || '0x',
        pc: pc | 0,
        errno: 0,
        stepCount: stepCount | 0,
        gasRemaining: gasRemaining || gasLimit || BLOCK_GAS_LIMIT,
        gasLimit: gasLimit || BLOCK_GAS_LIMIT,
        stack: stack || [],
        mem: mem || [],
        returnData: '0x',
      }
    );
  }
};
