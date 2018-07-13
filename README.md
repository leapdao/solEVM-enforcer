# Solidity EVM and Runtime (PoC)

This is a simple Ethereum runtime written in Solidity. The runtime contract allows you to execute evm bytecode with calldata and various other parameters. It is meant to be Truebit-style computation verification games for off-chain execution. Check the [architecture docs](/docs/Architecture.md) for details.

This is a fork of [https://github.com/Ohalo-Ltd/solevm](https://github.com/Ohalo-Ltd/solevm)

### Setup

Currently there are only tests using truffle. You can run the tests like this:

```
npm install
npm test
```

### Runtime

First of all, the `EthereumRuntime` code is designed to run on a constantinople net, with all constantinople features. The `genesis.json` file in the root folder can be used to configure the geth EVM (through the `--prestate` option).

The executable contract is `EthereumRuntime.sol`. The contract has an `execute` method which is used to run code. It has many overloaded versions, but the simplest version takes two arguments - `code` and `data`.

`code` is the bytecode to run.

`data` is the calldata.

The solidity type for both of them is `bytes memory`.

```
// Execute the given code and call-data.
    function execute(bytes memory code, bytes memory data) public pure returns (Result memory state);

    // Execute the given transaction.
    function execute(TxInput memory input) public pure returns (Result memory result);

    // Execute the given transaction in the given context.
    function execute(TxInput memory input, Context memory context) public pure returns (Result memory result);

```

The other alternatives have two objects, `TxInput` and `Context`:

```
    struct TxInput {
        uint64 gas;
        uint gasPrice;
        address caller;
        uint callerBalance;
        uint value;
        address target;
        uint targetBalance;
        bytes targetCode;
        bytes data;
        bool staticExec;
    }
```

The `gas` and `gasPrice` fields are reserved but never used, since gas is not yet supported. All the other params are obvious except for `staticExec` which should be set to `true` if the call should be executed as a `STATICCALL`, i.e. what used to be called a read-only call (as opposed to a transaction).

```
struct Context {
    address origin;
    uint gasPrice;
    uint gasLimit;
    uint coinBase;
    uint blockNumber;
    uint time;
    uint difficulty;
}
```

These fields all speak for themselves.

NOTE: There is no actual `CREATE` operation taking place for the contract account in which the code is run, i.e. the code to execute would normally be runtime code; however, the code being run can create new contracts.

The return value from the execute functions is a struct on the form:

```
struct Result {
    uint errno;
    uint errpc;
    bytes returnData;
    uint[] stack;
    bytes mem;
    uint[] accounts;
    bytes accountsCode;
    uint[] logs;
    bytes logsData;
}
```

`errno` - an error code. If execution was normal, this is set to 0.

`errpc` - the program counter at the time when execution stopped.

`returnData` - the return data. It will be empty if no data was returned.

`stack` - The stack when execution stopped.

`mem` - The memory when execution stopped.

`accounts` - Account data packed into an uint-array, omitting the account code.

`accountsCode` - The combined code for all accounts.

`logs` - Logs packed into an uint-array, omitting the log data.

`logsData` - The combined data for all logs.

Note that `errpc` is only meant to be used when the error is non-zero, in which case it will be the program counter at the time when the error was thrown.

There is a javascript (typescript) adapter at `script/adapter.ts` which allow you to run the execute function from within this library, and automatically format input and output parameters. The return data is formatted as such:

```
{
    errno: number,
    errpc: number,
    returnData: string (hex),
    stack: [BigNumber],
    mem: string (hex),
    accounts: [{
        address: string (hex),
        balance: BigNumber,
        nonce: BigNumber,
        destroyed: boolean
        storage: [{
            address: BigNumber,
            value: BigNumber
        }]
    }]
    logs: [{
        account: string (hex)
        topics: [BigNumber] (size 4)
        data: string (hex)
    }]
}
```

There is a pretty-print function in the adapter as well.

#### Accounts

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

When executing code, two accounts will always be created - the caller account, and the contract account used to run the provided code. In the simple "code + data" call, the caller and contract account are assigned default addresses.

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

### Logs

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
