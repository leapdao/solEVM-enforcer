const { BLOCK_GAS_LIMIT } = require('./constants');
const ethers = require('ethers');

export default class EthereumRuntimeAdapter {
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
  }

  execute ({ code, data, pc, stepCount, gasRemaining, gasLimit, stack, mem, accounts, accountsCode, logHash }) {
    return this.runtimeContract
      .execute(
        {
          code: code || '0x',
          data: data || '0x',
          pc: pc | 0,
          errno: 0,
          stepCount: stepCount | 0,
          gasRemaining: gasRemaining || gasLimit || BLOCK_GAS_LIMIT,
          gasLimit: gasLimit || BLOCK_GAS_LIMIT,
          stack: stack || [],
          mem: mem || '0x',
          accounts: accounts || [],
          accountsCode: accountsCode || '0x',
          returnData: '0x',
          logHash: logHash || '0x0000000000000000000000000000000000000000000000000000000000000000',
        }
      );
  };
}
