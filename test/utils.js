import BigNumber from 'bignumber.js';
const OP = require('./helpers/constants');
const { PUSH1 } = OP;

export const toNum = arr => arr.map(e => e.toNumber());

export const toHex = arr => arr.map(e => e.toString(16));

export const leftPad = (n, width) => {
  n = '' + n;
  return n.length >= width ? n : new Array(width - n.length + 1).join(0) + n;
};

export const pushRange = (from, to) => Array.from(
  { length: (to - from + 1) * 2 },
  (_, i) => i % 2 === 0 ? PUSH1 : leftPad(Math.floor((i / 2) + from), 2)
);

export const range = (from, to) => Array.from({ length: to - from + 1 }, (x, i) => i + from);

export const hexRange = (from, to) => parseInt(range(from, to).join(''), 16);

export const opcodeNames = Object.keys(OP).reduce((s, k) => { s[OP[k]] = k; return s; }, {});

export const encodeAccounts = (accounts) => {
  accounts = accounts.map(account => {
    return Object.assign({
      nonce: 0,
      balance: 0,
      destroyed: false,
      code: '',
      storage: [],
    }, account);
  });

  const accountsOut = [];
  let accountsCode = '';
  let codeOffset = 0;
  for (const account of accounts) {
    accountsOut.push(account.address);
    accountsOut.push(account.balance);
    accountsOut.push(account.nonce);
    accountsOut.push(account.destroyed ? 1 : 0);
    accountsOut.push(codeOffset / 2);
    accountsOut.push(account.code.length / 2);
    accountsOut.push(account.storage.length);
    for (const entry of account.storage) {
      accountsOut.push(entry.address);
      accountsOut.push(entry.value);
    }
    codeOffset += account.code.length;
    accountsCode += account.code;
  }

  return {
    accounts: accountsOut,
    accountsCode,
  };
};

export const decodeAccounts = (accsArr, accsCode = '') => {
  if (accsCode && accsCode.length >= 2) {
    accsCode = accsCode.substr(2);
  }
  const accounts = [];
  let offset = 0;

  while (offset < accsArr.length) {
    let addr = '0x' + leftPad(new BigNumber(accsArr[offset]).toString(16), 40);
    const balance = new BigNumber(accsArr[offset + 1]);
    const nonce = new BigNumber(accsArr[offset + 2]).toNumber();
    const destroyed = new BigNumber(accsArr[offset + 3]).toNumber() === 1;
    const codeIdx = new BigNumber(accsArr[offset + 4]).toNumber();
    const codeSize = new BigNumber(accsArr[offset + 5]).toNumber();
    const code = accsCode.substr(2 * codeIdx, 2 * codeSize);
    const storageSize = new BigNumber(accsArr[offset + 6]).toNumber();
    const storage = [];
    for (let j = 0; j < storageSize; j++) {
      const address = accsArr[offset + 7 + 2 * j].toNumber();
      const value = accsArr[offset + 7 + 2 * j + 1].toNumber();
      if (value !== 0) {
        storage.push({
          address,
          value,
        });
      }
    }
    accounts.push({
      address: addr,
      balance,
      nonce,
      destroyed,
      code,
      storage,
    });

    offset += 7 + 2 * storageSize;
  }
  return accounts;
};

export const decodeLogs = (logsArr, logsCode = '') => {
  if (logsCode && logsCode.length >= 2) {
    logsCode = logsCode.substr(2);
  }

  const logs = [];
  let offset = 0;

  while (offset < logsArr.length) {
    let addr = '0x' + leftPad(new BigNumber(logsArr[offset]).toString(16), 40);
    const topics = [];
    topics.push(logsArr[offset + 1].toNumber());
    topics.push(logsArr[offset + 2].toNumber());
    topics.push(logsArr[offset + 3].toNumber());
    topics.push(logsArr[offset + 4].toNumber());
    const dataIdx = new BigNumber(logsArr[offset + 5]).toNumber();
    const dataSize = new BigNumber(logsArr[offset + 6]).toNumber();
    const data = '0x' + logsCode.substr(2 * dataIdx, 2 * dataSize);

    logs.push({
      account: addr,
      topics,
      data,
    });
    offset += 7;
  }
  return logs;
};

export const unpack = ([uints, stack, accounts, logs, bytes]) => {
  bytes = bytes.substring(2);
  const bytesOffsets = uints.slice(4).map(o => o * 2);
  const returnData = `0x${bytes.substring(0, bytesOffsets[0])}`;
  const memory = `0x${bytes.substring(bytesOffsets[0], bytesOffsets[0] + bytesOffsets[1])}`;
  const accountsCode = `0x${bytes.substring(bytesOffsets[1], bytesOffsets[1] + bytesOffsets[2])}`;
  const logsData = `0x${bytes.substring(bytesOffsets[2], bytesOffsets[2] + bytesOffsets[3])}`;
  const [errno, errpc, pc, gasRemaining] = uints.slice(0, 4).map(n => n.toNumber());
  return { errno, errpc, pc, returnData, stack, memory, accounts, accountsCode, logs, logsData, gasRemaining };
};
