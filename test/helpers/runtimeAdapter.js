const { BLOCK_GAS_LIMIT } = require('./constants');

export default class RuntimeAdapter {
  constructor (runtimeContract) {
    this.runtimeContract = runtimeContract;
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
