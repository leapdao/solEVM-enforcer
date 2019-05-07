module.exports = async (promise, message) => {
  try {
    let tx = await promise;
    // geth doesn't fail immediately
    await tx.wait();
  } catch (error) {
    // support for the unspecific error 'transaction failed' of geth
    const revertFound = error.message.search(/(revert|transaction failed)/) >= 0;
    assert(revertFound, `Expected "revert", got ${error} instead`);
    if (message) {
      const messageFound = error.message.search(message) >= 0;
      assert(messageFound, `Expect ${message}, got ${error} instead`);
    }
    return;
  }
  assert.fail('Expected revert not received');
};
