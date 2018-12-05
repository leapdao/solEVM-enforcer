import chai from 'chai';
import { deployContract, wallets } from './utils.js';
import { ethers } from 'ethers';

const Verifier = artifacts.require("./SampleVerifier.sol");
const Enforcer = artifacts.require("./Enforcer");

const should = chai
  .use(require('chai-as-promised'))
  .should();

let verifier;
let enforcer;

contract('SampleVerifier', () => {
  before(async () => {
    verifier = await deployContract(Verifier, 100);
    enforcer = await deployContract(Enforcer, verifier.address, 0, 100);
  });

  it("should have timeout set", async () => {
    assert.equal(await verifier.timeoutDuration(), 100, "timeout not set");
  });

  it("can set enforcer", async () => {
    await verifier.setEnforcer(enforcer.address);
    assert.equal(await verifier.enforcer(), enforcer.address, "enforcer not set");
  });

  it("should allow enforcer to initGame", async () => {
    // fake enforcer
    await verifier.setEnforcer(wallets[0].address);
    await verifier.initGame(
      ethers.utils.formatBytes32String("1"),
      ethers.utils.formatBytes32String("execHashsolver"), 10,
      ethers.utils.formatBytes32String("execHashChallenger"), 10,
      wallets[0].address,
      wallets[1].address
    );
  })
})
