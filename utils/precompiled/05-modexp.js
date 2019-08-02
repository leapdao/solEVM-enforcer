'use strict';

const utils = require('ethereumjs-util');
const BN = utils.BN;

function multComplexity (x) {
  if (x.lten(64)) {
    return x.sqr();
  }

  if (x.lten(1024)) {
    // return Math.floor(Math.pow(x, 2) / 4) + 96 * x - 3072
    const fac1 = x.sqr().divn(4);
    const fac2 = x.muln(96);

    return fac1.add(fac2).subn(3072);
  }

  // return Math.floor(Math.pow(x, 2) / 16) + 480 * x - 199680
  const fac1 = x.sqr().divn(16);
  const fac2 = x.muln(480);

  return fac1.add(fac2).subn(199680);
}

function getAdjustedExponentLength (data) {
  let expBytesStart;
  try {
    const baseLen = new BN(data.slice(0, 32)).toNumber();

    expBytesStart = 96 + baseLen;
    // 96 for base length,
    // then exponent length,
    // and modulus length,
    // then baseLen for the base data,
    // then exponent bytes start
  } catch (e) {
    expBytesStart = Number.MAX_SAFE_INTEGER - 32;
  }
  const expLen = new BN(data.slice(32, 64));
  let firstExpBytes = Buffer.from(data.slice(expBytesStart, expBytesStart + 32)); // first word of the exponent data
  firstExpBytes = utils.setLengthRight(firstExpBytes, 32); // reading past the data reads virtual zeros
  firstExpBytes = new BN(firstExpBytes);
  let max32expLen = 0;

  if (expLen.ltn(32)) {
    max32expLen = 32 - expLen.toNumber();
  }
  firstExpBytes = firstExpBytes.shrn(8 * Math.max(max32expLen, 0));

  let bitLen = -1;
  while (firstExpBytes.gtn(0)) {
    bitLen = bitLen + 1;
    firstExpBytes = firstExpBytes.ushrn(1);
  }

  let expLenMinus32OrZero = expLen.subn(32);
  if (expLenMinus32OrZero.ltn(0)) {
    expLenMinus32OrZero = new BN(0);
  }

  const eightTimesExpLenMinus32OrZero = expLenMinus32OrZero.muln(8);
  let adjustedExpLen = eightTimesExpLenMinus32OrZero;
  if (bitLen > 0) {
    adjustedExpLen.iaddn(bitLen);
  }

  return adjustedExpLen;
}

function expmod (B, E, M) {
  if (E.isZero()) {
    return new BN(1).mod(M);
  }

  // Red asserts M > 1
  if (M.lten(1)) {
    return new BN(0);
  }

  const red = BN.red(M);
  const redB = B.toRed(red);
  const res = redB.redPow(E);
  return res.fromRed();
}

function getOOGResults (gasLimit, results) {
  results.returnValue = Buffer.alloc(0);
  results.gasUsed = gasLimit;
  results.exception = 0;
  return results;
}

module.exports = function (gasLimit, data) {
  const results = {};

  let adjustedELen = getAdjustedExponentLength(data);
  if (adjustedELen.ltn(1)) {
    adjustedELen = new BN(1);
  }

  const bLen = new BN(data.slice(0, 32));
  const eLen = new BN(data.slice(32, 64));
  let mLen = new BN(data.slice(64, 96));
  let maxLen = bLen;

  if (maxLen.lt(mLen)) {
    maxLen = mLen;
  }

  const Gquaddivisor = 20;
  const gasUsed = adjustedELen.mul(multComplexity(maxLen)).divn(Gquaddivisor);

  if (gasLimit.lt(gasUsed)) {
    return getOOGResults(gasLimit, results);
  }

  results.gasUsed = gasUsed;

  if (bLen.isZero()) {
    results.returnValue = new BN(0).toArrayLike(Buffer, 'be', 1);
    results.exception = 1;
    return results;
  }

  if (mLen.isZero()) {
    results.returnValue = Buffer.alloc(0);
    results.exception = 1;
    return results;
  }

  const maxInt = new BN(Number.MAX_SAFE_INTEGER);
  const maxSize = new BN(2147483647);

  if (bLen.gt(maxSize) || eLen.gt(maxSize) || mLen.gt(maxSize)) {
    return getOOGResults(gasLimit, results);
  }

  const bStart = new BN(96);
  const bEnd = bStart.add(bLen);
  const eStart = bEnd;
  const eEnd = eStart.add(eLen);
  const mStart = eEnd;
  const mEnd = mStart.add(mLen);

  if (mEnd.gt(maxInt)) {
    return getOOGResults(gasLimit, results);
  }

  mLen = mLen.toNumber();

  const B = new BN(utils.setLengthRight(data.slice(bStart.toNumber(), bEnd.toNumber()), bLen.toNumber()));
  const E = new BN(utils.setLengthRight(data.slice(eStart.toNumber(), eEnd.toNumber()), eLen.toNumber()));
  const M = new BN(utils.setLengthRight(data.slice(mStart.toNumber(), mEnd.toNumber()), mLen));

  let R;
  if (M.isZero()) {
    R = new BN(0);
  } else {
    R = expmod(B, E, M);
  }

  results.returnValue = R.toArrayLike(Buffer, 'be', mLen);
  results.exception = 1;

  return results;
};
