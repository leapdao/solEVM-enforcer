pragma solidity 0.5.2;
pragma experimental ABIEncoderV2;

import "./EVMRuntime.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


/*
 * Resources:
 *  https://github.com/leapdao/leap-contracts/blob/master/contracts/ExitHandler.sol
 *  https://docs.google.com/drawings/d/1bDlF7ORgQ4W1pkMNk0MoUb6nQFEq72f9ZjBVsKBvbyE/edit
 *  https://github.com/leapdao/leap-node/blob/feature/SpendingConditions/src/tx/applyTx/checkSpendCond.test.js
 *
 */
contract Interceptor is Ownable, EVMRuntime {

    bytes4 constant internal FUNC_SIG_BALANCE_OF = hex'70a08231';

    bytes4 constant internal FUNC_SIG_TRANSFER = hex'a9059cbb';

    struct Input {
        address caller;
        address spendingCondition;
        address tokenContract;
        address bridgeContract;
        // this should be tx inputs in the future
        bytes callData;
    }

    struct Result {
        uint errno;
        bytes returnData;
        bytes32 logHash;
        uint gas;
    }

    event ResultEvent(Result res);

    constructor() public Ownable() {
    }

    function run(Input memory input) public returns (Result memory res) {
        EVM memory evm;

        evm.context = Context(
            // origin
            input.caller,
            // gasPrice
            1,
            BLOCK_GAS_LIMIT,
            0,
            0,
            0,
            0
        );

        evm.data = input.callData;
        evm.gas = BLOCK_GAS_LIMIT;

        EVMAccounts.Account memory spendingAcc = evm.accounts.get(input.spendingCondition);
        spendingAcc.code = EVMCode.fromAddress(input.spendingCondition);
        spendingAcc.nonce = uint8(1);

        EVMAccounts.Account memory callerAcc = evm.accounts.get(input.caller);
        callerAcc.nonce = uint8(1);

        EVMAccounts.Account memory tokenAcc = evm.accounts.get(input.tokenContract);
        tokenAcc.code = EVMCode.fromAddress(input.tokenContract);
        tokenAcc.nonce = uint8(1);

        evm.caller = callerAcc;
        evm.target = spendingAcc;

        evm.code = evm.target.code;
        evm.stack = EVMStack.newStack();
        evm.mem = EVMMemory.newMemory();

        _run(evm, 0, 0);

        res.errno = evm.errno;
        res.gas = evm.gas;
        res.returnData = evm.returnData;
        res.logHash = evm.logHash;

        emit ResultEvent(res);
    }

    function handleSLOAD(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleCREATE(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    function handleSELFDESTRUCT(EVM memory state) internal {
        state.errno = ERROR_INSTRUCTION_NOT_SUPPORTED;
    }

    /*
     * This is used to by solc to check if a address is indeed a contract (has code).
     * We only allow our tokenContract & bridgeContract here.
     */
    function handleEXTCODESIZE(EVM memory state) internal {
        Input memory input;
        assembly {
            // the position of Input struct from run()
            input := 0x80
        }
        address target = address(state.stack.pop());

        if (target != input.tokenContract && target != input.bridgeContract) {
            state.stack.push(0);
            return;
        }

        state.stack.push(1);
    }

    event Foo(address caller, address target, address spendingCondition, address tokenContract, bytes callData, bytes4 functionSig);

    function handleCall(EVM memory state, address target, uint inOffset, uint inSize) internal returns (bytes memory) {
        /*
         * TODO
         *
         * for balanceOf() on a token contract the input's balance should be returned.
         * balanceOf returns uint256
         * 0x70a08231
         * 000000000000000000000000df08f82de32b8d460adbe8d72043e3a7e25a3b39
         *
         * for transfer() on a token contract a LOG event should be emitted.
         * transfer returns bool
         * 0xa9059cbb
         * 000000000000000000000000df08f82de32b8d460adbe8d72043e3a7e25a3b39
         * 000000000000000000000000000000000000000000000000000000000000ffff
         *
         * for getPeriod() on the bridge the call should be forwarded to the actual bridge contract.
         * ERC721 has a different interface for transfer()
         * function transferFrom(address from, address to, uint256 tokenId) public;
         * 
         */

        uint dataPtr = state.mem.memUPtr(inOffset);
        bytes4 functionSig;
        assembly {
            functionSig := mload(dataPtr)
        }

        Input memory input;
        assembly {
            // the position of Input struct from run()
            input := 0x80
        }

        emit Foo(
            state.caller.addr,
            target,
            input.spendingCondition,
            input.tokenContract,
            state.mem.toArray(inOffset, inSize),
            functionSig
        );

        // TODO: do real checks

        if (functionSig == FUNC_SIG_TRANSFER) {
            // emit a Transfer event here if successful
            state.stack.push(1);
            return abi.encode(["bool"], [true]);
        }

        if (functionSig == FUNC_SIG_BALANCE_OF) {
            state.stack.push(1);
            return abi.encode(["uint256"], [0xffff]);
        }

        // invalid
        state.stack.push(0);
        return "";
    }

    function handleCALL(EVM memory state) internal {
        uint gas = state.stack.pop();
        address target = address(state.stack.pop());
        uint value = state.stack.pop();
        uint inOffset = state.stack.pop();
        uint inSize = state.stack.pop();
        uint retOffset = state.stack.pop();
        uint retSize = state.stack.pop();

        bytes memory returnData = handleCall(state, target, inOffset, inSize);
        state.lastRet = returnData;

        if (returnData.length != 0) {
            state.mem.storeBytesAndPadWithZeroes(returnData, 0, retOffset, retSize);
        }
    }

    function handleSTATICCALL(EVM memory state) internal {
        uint gas = state.stack.pop();
        address target = address(state.stack.pop());
        uint inOffset = state.stack.pop();
        uint inSize = state.stack.pop();
        uint retOffset = state.stack.pop();
        uint retSize = state.stack.pop();

        bytes memory returnData = handleCall(state, target, inOffset, inSize);
        state.lastRet = returnData;

        if (returnData.length != 0) {
            state.mem.storeBytesAndPadWithZeroes(returnData, 0, retOffset, retSize);
        }
    }
}
