const OP = require('./../../utils/constants');
const ethers = require('ethers');
const { PUSH1 } = OP;

const Utils = {};

Utils.toBN = require('ethers').utils.bigNumberify;

Utils.toBytes32 = require('ethers').utils.formatBytes32String;

Utils.toNum = arr => arr.map(e => e.toNumber());

Utils.toStr = arr => arr.map(e => e.toString());

Utils.toHex = arr => arr.map(e => e.toString(16));

Utils.leftPad = (n, width) => {
  n = '' + n;
  return n.length >= width ? n : new Array(width - n.length + 1).join(0) + n;
};

Utils.pushRange = (from, to) => Array.from(
  { length: (to - from + 1) * 2 },
  (_, i) => i % 2 === 0 ? PUSH1 : Utils.leftPad(Math.floor((i / 2) + from), 2)
);

Utils.range = (from, to) => Array.from({ length: to - from + 1 }, (x, i) => (i + from).toString());

Utils.hexRange = (from, to) => Utils.toBN('0x' + Utils.range(from, to).join('')).toString();

Utils.opcodeNames = Object.keys(OP).reduce((s, k) => { s[OP[k]] = k; return s; }, {});

Utils.encodeAccounts = (accounts) => {
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

Utils.decodeAccounts = (accsArr, accsCode = '') => {
  accsCode = accsCode.replace('0x', '');

  const accounts = [];
  let offset = 0;

  while (offset < accsArr.length) {
    let addr = accsArr[offset].toHexString();
    const balance = accsArr[offset + 1].toHexString();
    const nonce = accsArr[offset + 2].toNumber();
    const destroyed = accsArr[offset + 3].toNumber() === 1;
    const codeIdx = accsArr[offset + 4].toNumber();
    const codeSize = accsArr[offset + 5].toNumber();
    const code = accsCode.substr(2 * codeIdx, 2 * codeSize);
    const storageSize = accsArr[offset + 6].toNumber();
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

Utils.decodeLogs = (logsArr, logsCode = '') => {
  if (logsCode && logsCode.length >= 2) {
    logsCode = logsCode.substr(2);
  }

  const logs = [];
  let offset = 0;

  while (offset < logsArr.length) {
    let addr = Utils.toBN(logsArr[offset]).toHexString();
    const topics = [];
    topics.push(logsArr[offset + 1].toNumber());
    topics.push(logsArr[offset + 2].toNumber());
    topics.push(logsArr[offset + 3].toNumber());
    topics.push(logsArr[offset + 4].toNumber());
    const dataIdx = Utils.toBN(logsArr[offset + 5]).toNumber();
    const dataSize = Utils.toBN(logsArr[offset + 6]).toNumber();
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

Utils.getCodeWithStep = (fixture) => {
  let code;
  if (!fixture.join) {
    code = fixture.code || [];
    if (!code.join) { // wrap single opcode
      code = [code];
    }
  } else {
    code = fixture;
  }

  const codeSize = code.length;
  const pc = fixture.pc !== undefined ? fixture.pc : codeSize - 1;
  const opcodeUnderTest = Utils.opcodeNames[code[pc]];
  const step = fixture.step !== undefined ? fixture.step : 0;
  return { code, step, opcodeUnderTest };
};

Utils.getCode = (fixture) => {
  let code;
  if (!fixture.join) {
    code = fixture.code || [];
    if (!code.join) { // wrap single opcode
      code = [code];
    }
  } else {
    code = fixture;
  }

  const codeSize = code.length;
  const pc = fixture.pc !== undefined ? fixture.pc : codeSize - 1;
  const opcodeUnderTest = Utils.opcodeNames[code[pc]];
  return { code, codeSize, pc: ~~pc, opcodeUnderTest };
};

Utils.provider =
  typeof web3 !== 'undefined' ? new ethers.providers.Web3Provider(web3.currentProvider) : undefined;

Utils.txOverrides = {
  gasLimit: 0xfffffffffffff,
  gasPrice: 0x01,
};

Utils.deployContract = async function (truffleContract, ...args) {
  let _factory = new ethers.ContractFactory(
    truffleContract.abi,
    truffleContract.bytecode,
    Utils.wallets[0]
  );
  const contract = await _factory.deploy(...args, Utils.txOverrides);

  await contract.deployed();
  return contract;
};

Utils.deployCode = async function (code) {
  let codeLen = code.length.toString(16);

  if (codeLen.length === 1) {
    codeLen = '0' + codeLen;
  }

  let codeOffset = '0b';
  let codeCopy = [
    OP.PUSH1, codeLen,
    OP.DUP1,
    OP.PUSH1, codeOffset,
    OP.PUSH1, '00',
    OP.CODECOPY,
    OP.PUSH1, '00',
    OP.RETURN,
  ];
  const obj = {
    abi: [],
    bytecode: '0x' + codeCopy.join('') + code.join(''),
  };

  return Utils.deployContract(obj);
};

Utils.wallets = [];

for (var i = 0; i < 10; i++) {
  const privateKey = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b750120' + i;
  const wallet = new ethers.Wallet(privateKey, Utils.provider);
  Utils.wallets.push(wallet);
}

module.exports = Utils;
