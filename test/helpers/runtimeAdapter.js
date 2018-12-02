const { BLOCK_GAS_LIMIT } = require('./constants');

export default class RuntimeAdapter {
  constructor (runtimeContract) {
    this.runtimeContract = runtimeContract;
  }

  buildArgs(code, data, params, stack, memory, accounts, accountsCode, logHash) {
    return [
        code,
        data,
        params || [0, 0, BLOCK_GAS_LIMIT, gasLimit],
        stack || [],
        memory || '0x',
        accounts || [],
        accountsCode || '0x',
        logHash || '0x0000000000000000000000000000000000000000000000000000000000000000'
    ];
  }

  executeAndStop (code, data, params) {
    assert(params.length === 4);
    return this.runtimeContract.execute(...this.buildArgs(code, data, params));
  };

  initAndExecute (code, data, params, stack, memory, accounts, accountsCode, logHash) {
    assert(params.length === 4);
    return this.runtimeContract
      .execute(
        ...this.buildArgs(code, data, params, stack, memory, accounts, accountsCode, logHash)
      );
  };

  execute (code, data, gasLimit = BLOCK_GAS_LIMIT) {
    return this.runtimeContract
      .execute(
        ...this.buildArgs(code, data, [0, 0, BLOCK_GAS_LIMIT, gasLimit])
      );
  };
}
