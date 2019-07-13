'use strict';

const assert = require('assert');
const Utils = require('./utils');

module.exports = async (promise, message) => {
  try {
    let tx = await promise;
    // geth doesn't fail immediately
    await tx.wait();
  } catch (error) {
    // support for the unspecific error 'transaction failed' of geth
    const revertFound = error.message.search(/(revert|transaction failed|always failing transaction)/) >= 0;
    assert(revertFound, `Expected "revert", got ${error} instead`);
    const client = await Utils.client();
    // Geth does not return full error message
    if (message && !client.startsWith('Geth')) {
      const messageFound = error.message.search(message) >= 0;
      assert(messageFound, `Expect ${message}, got ${error} instead`);
    }
    return;
  }
  assert.fail('Expected revert not received');
};
