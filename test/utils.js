const OP = require('./helpers/constants');
const ethers = require('ethers');
const { PUSH1 } = OP;

export const toBN = require('ethers').utils.bigNumberify;

export const toNum = arr => arr.map(e => e.toNumber());

export const toStr = arr => arr.map(e => e.toString());

export const toHex = arr => arr.map(e => e.toString(16));

export const leftPad = (n, width) => {
  n = '' + n;
  return n.length >= width ? n : new Array(width - n.length + 1).join(0) + n;
};

export const pushRange = (from, to) => Array.from(
  { length: (to - from + 1) * 2 },
  (_, i) => i % 2 === 0 ? PUSH1 : leftPad(Math.floor((i / 2) + from), 2)
);

export const range = (from, to) => Array.from({ length: to - from + 1 }, (x, i) => (i + from).toString());

export const hexRange = (from, to) => toBN('0x' + range(from, to).join('')).toString();

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
    let addr = toBN(accsArr[offset]).toHexString();
    const balance = toBN(accsArr[offset + 1]);
    const nonce = toBN(accsArr[offset + 2]).toNumber();
    const destroyed = toBN(accsArr[offset + 3]).toNumber() === 1;
    const codeIdx = toBN(accsArr[offset + 4]).toNumber();
    const codeSize = toBN(accsArr[offset + 5]).toNumber();
    const code = accsCode.substr(2 * codeIdx, 2 * codeSize);
    const storageSize = toBN(accsArr[offset + 6]).toNumber();
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
    let addr = toBN(logsArr[offset]).toHexString();
    const topics = [];
    topics.push(logsArr[offset + 1].toNumber());
    topics.push(logsArr[offset + 2].toNumber());
    topics.push(logsArr[offset + 3].toNumber());
    topics.push(logsArr[offset + 4].toNumber());
    const dataIdx = toBN(logsArr[offset + 5]).toNumber();
    const dataSize = toBN(logsArr[offset + 6]).toNumber();
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

export const getCode = (fixture) => {
  let code;
  if (!fixture.join) {
    code = fixture.code || [];
    if (!code.join) { // wrap single opcode
      code = [code];
    }
  } else {
    code = fixture;
  }

  code = `0x${code.join('')}`;
  const codeSize = (code.length - 2) / 2;
  const pc = fixture.pc !== undefined ? fixture.pc : codeSize - 1;
  const opcodeUnderTest = opcodeNames[code.substring(2 + pc * 2, 2 + pc * 2 + 2)];
  return { code, codeSize, pc: ~~pc, opcodeUnderTest };
};

export const wallets = [];

const provider = new ethers.providers.Web3Provider(web3.currentProvider);

for (var i = 0; i < 10; i++) {
  const privateKey = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120' + i;
  const wallet = new ethers.Wallet(privateKey, provider);
  wallets.push(wallet);
}

export const txOverrides = {
    gasLimit: 0xffffffff,
};

export async function deployContract(truffleContract, ...args) {
  let _factory = new ethers.ContractFactory(
    truffleContract.abi,
    truffleContract.bytecode,
    wallets[0]
  );
  const contract = await _factory.deploy(...args, txOverrides);

  await contract.deployed();
  return contract;
}
