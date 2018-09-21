import { unpack } from '../utils';
const { BLOCK_GAS_LIMIT } = require('./constants');

export default class RuntimeAdapter {
  constructor (runtimeContract) {
    this.runtimeContract = runtimeContract;
  }

  executeAndStop (code, data, params) {
    assert(params.length === 4);
    return this.runtimeContract
      .execute(code, data, params, [], '0x', [], '0x', [], '0x')
      .then(unpack);
  };

  initAndExecute (code, data, params, stack, memory, accounts, accountsCode, logs, logsData) {
    assert(params.length === 4);
    return this.runtimeContract
      .execute(code, data, params, stack, memory, accounts, accountsCode, logs, logsData)
      .then(unpack);
  };

  execute (code, data, gasLimit = BLOCK_GAS_LIMIT) {
    return this.runtimeContract
      .execute(code, data, [0, 0, BLOCK_GAS_LIMIT, gasLimit], [], '0x', [], '0x', [], '0x')
      .then(unpack);
  };
}
