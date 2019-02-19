# EVM Enforcer [![Build Status](https://travis-ci.org/leapdao/solEVM-enforcer.svg?branch=master)](https://travis-ci.org/leapdao/solEVM-enforcer)

![EVM Enforcer](https://i.imgur.com/V9EGql2.png)

The **EVM Enforcer** is a computation verification engine that allows on-chain enforcement of off-chain EVM execution. 

![Process Diagram](https://i.imgur.com/o1FRMqp.png)

Anyone who solved some off-chain execution can register a result with the *Enforcer contract*. A challenge period starts during which challengers can open disputes over the presented results. Disputes are delegated to the *Verifier contract* where solver and challenger play an interactive execution verification game. If the challenger wins, the execution results are deleted and the solver looses a bond. If the solver is able to defend the execution results throughout the challenge period, the result is accepted.


## FAQ

- **What is the relationship to solEVM?**
The EVM enforcer is built on [Andreas Olofsson](https://github.com/androlo)'s [solEVM](https://github.com/Ohalo-Ltd/solevm). Thank you Andreas :clap: !
- **How is this different than Truebit?**
[Truebit](http://truebit.io)'s interactive computation verification game uses a [WebAssembly](https://webassembly.org/) VM. We allow to run EVM bytecode. 
- **What do you use this for?**
We use this to enforce the correctness of transaction in [Plasma Leap](https://ethresear.ch/t/plasma-leap-a-state-enabled-computing-model-for-plasma/3539).


## Contributions

You are very welcome to contribute by:
- Picking `beginner-friendly` issues from the backlog.
- Joining the [Discord channel](https://discord.gg/7bfD6eB) to ask questions.
- Participating in the [bi-weekly hangouts](https://hackmd.io/Kn0hwBA7Tvm6mfacCH1rIw?both).

Please make sure to read the contribution guidelines.


## Setup

Currently there are only tests using truffle. You can run the tests like this:

```
npm install
npm test
```

## Runtime - EVMRuntime.sol

The runtime contract is `EVMRuntime.sol`. The contract is designed with extensibility in mind.
The most basic contract which makes use of it is [EthereumRuntime.sol](https://github.com/leapdao/solEVM-enforcer/blob/master/contracts/EVMRuntime.sol),
the contract has an `execute` function which is used to run code.

Other contracts which makes use of the `EVMRuntime` are:
- [Verifier.sol](https://github.com/leapdao/solEVM-enforcer/blob/master/contracts/Verifier.sol)


## Off-chain Interpreter & Merkelizer | Based on ethereumjs-vm :clap:

It also exists a corresponding runtime implementation on the JS side.
[You can take a look at the on-chain Verifier unit test on how it's used.](https://github.com/leapdao/solEVM-enforcer/blob/master/test/verifier.js)

[The OffchainStepper mimics the EthereumRuntime contract](https://github.com/leapdao/solEVM-enforcer/blob/master/utils/OffchainStepper.js)
and together with the [Merkelizer](https://github.com/leapdao/solEVM-enforcer/blob/master/utils/Merkelizer.js),
creates a Merkle Root of the individual execution steps (before and after each opcode) given `code`, `data` and other runtime properties.

The `OffchainStepper` & `Merkelizer` are *WIP* too, as they get further improved and refactored to get closer to the `EVMRuntime` class model.

For the curious, there is also a [off-chain Dispute mock-implementation](https://github.com/leapdao/solEVM-enforcer/blob/master/utils/DisputeMock.js),
with the same logic like the on-chain `Verifier` contract.


#### Work In Progress

The design decision that the `EVMRuntime.sol` will be the base 'class' for contracts needing a runtime environment is final,
though the whole interface design is not final yet.

It is planned that the `struct EVM` will hold a pointer to memory where users can point to their custom data / structure,
this property gives the most flexibility for developers working with the `EVMRuntime` without hitting contract size-, maximal stack depth or other limitations.



### Accounts - EVMAccounts.slb

Accounts are on the following format:

```
account : {
    addr: address,
    balance: uint,
    nonce: uint8,
    destroyed: bool
    code: bytes
    storage: [{
        addr: uint,
        val: uint
    }]
}
```

`nonce` is restricted to `uint8` (max 255) to make new account creation easier, since it will get a simpler RLP encoding.

The `destroyed` flag is used to indicate whether or not a (contract) account has been destroyed during execution. This can only happen if `SELFDESTRUCT` is called in that contract.

In the simple `EthereumRuntime.execute` call, the caller and contract account are assigned default addresses.

In contract code, accounts and account storage are both arrays instead of maps. Technically they are implemented as (singly) linked lists. This will be improved later.

The "raw" int arrays in the return object has an account packed in the following way:

- `0`: account address

- `1`: account balance

- `2`: account nonce

- `3`: account destroyed (true or false)

- `4`: code starting index (in combined 'accountsCode' array).

- `5`: code size

- `6`: number of entries in storage

- `7`+ : pairs of (address, value) storage entries

The size of an account is thus: `7 + storageEntries*2`.

The `accounts` array is a series of accounts: `[account0, account1, ... ]`


### Logs - EVMLogs.slb

`EVMLogs.slb` is a helper library to deal with LOG events.

Logs are on the following format:

```
log: {
     account: address
     topics: uint[4]
     data: bytes
 }
```

`account` - The address of the account that generated the log entry.

`topics` - The topics.

`data` - The data.

The "raw" int arrays in the return object has a log packed in the following way:

- `0`: account address

- `1 - 4`: topics

- `5`: data starting index (in combined 'logsData' array).

- `6`: data size.


### Blockchain

There are no blocks, so `BLOCKHASH` will always return `0`. The only blockchain related parameters that can be set are those in the context object.
