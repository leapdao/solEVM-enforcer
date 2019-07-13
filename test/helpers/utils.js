'use strict';

const OP = require('./../../utils/constants');
// TODO make a util contract
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

Utils.provider = new ethers.providers.JsonRpcProvider(`http://localhost:${process.env.RPC_PORT}`);
Utils.provider.pollingInterval = 30;

Utils.client = async () => {
  if (Utils.clientName === undefined) {
    Utils.clientName = await Utils.provider.send('web3_clientVersion', []);
  }
  return Utils.clientName;
};

Utils.txOverrides = {
  gasLimit: 0xfffffffffffff,
  gasPrice: 0x01,
};

Utils.deployContract = async function (truffleContract, ...args) {
  // wait for RPC
  while (true) {
    try {
      await Utils.provider.getBlockNumber();
      break;
    } catch (e) {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

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
  let codeLen = (code.join('').length / 2).toString(16);

  if (codeLen.length % 2 === 1) {
    codeLen = '0' + codeLen;
  }

  let codeOffset = (10 + codeLen.length / 2).toString(16);
  if (codeOffset.length % 2 === 1) {
    codeOffset = '0' + codeOffset;
  }
  let codeCopy = [
    OP[`PUSH${codeLen.length / 2}`], codeLen,
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

Utils.onchainWait = async function onchainWait (t) {
  for (let i = 0; i < t; i++) {
    let tx = await Utils.wallets[0].sendTransaction({ to: Utils.wallets[0].address });
    tx = await tx.wait();
  }
};

Utils.sleep = async function sleep (seconds) {
  seconds = seconds + 1;
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

module.exports = Utils;
