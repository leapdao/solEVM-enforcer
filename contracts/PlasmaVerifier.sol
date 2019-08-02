pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./Verifier.sol";


contract PlasmaVerifier is Verifier {
    bytes4 constant internal FUNC_SIG_BALANCE_OF = hex'70a08231';
    bytes4 constant internal FUNC_SIG_TRANSFER = hex'a9059cbb';

    constructor(uint256 timeout) public Verifier(timeout) {
    }

    event ResultEvent(uint errno, uint gas, bytes returnData);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event BalanceEvent(address tokenAddr, address owner);

    event InfoEvent(
        address caller,
        address currentTarget,
        address target,
        bytes4 functionSig,
        address inputcaller,
        address spendingAddr
    );

    struct Input {
        address caller;
        address spendingCondition;
        bytes callData;
    }

    function testRun(Input memory input) public {
        EVM memory evm;
        HydratedState memory hydratedState = initHydratedState(evm);
        evm.data = input.callData;
        evm.gas = 0xffffffff;
        evm.code = EVMCode.fromAddress(input.spendingCondition);
        evm.stack = EVMStack.newStack();
        evm.mem = EVMMemory.newMemory();

        _run(evm, 0, 0);

        emit ResultEvent(evm.errno, evm.gas, evm.returnData);
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
        state.returnData = returnData;

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
        state.returnData = returnData;

        if (returnData.length != 0) {
            state.mem.storeBytesAndPadWithZeroes(returnData, 0, retOffset, retSize);
        }
    }

    // solhint-disable-next-line function-max-lines
    function handleCall(EVM memory state, address target, uint inOffset, uint inSize) internal returns (bytes memory) {
        bytes4 functionSig = bytes4(bytes32(state.mem.load(inOffset)));

        Input memory input;
        assembly {
            let ptr := mload(0x40)
            mstore(0x40, add(ptr, 64))
            calldatacopy(ptr, add(4, 0x20), 64)
            input := ptr
        }

        emit InfoEvent(
            state.caller,
            state.target,
            target,
            functionSig,
            input.caller,
            input.spendingCondition
        );

        // TODO: do real checks

        if (functionSig == FUNC_SIG_BALANCE_OF) {
            // do this shit only this way
            address balanceOf = address(uint160(state.mem.load(inOffset + 4)));

            emit BalanceEvent(target, balanceOf);
            state.stack.push(1);

            return abi.encode(["uint256"], [0xffff]);
        }

        if (functionSig == FUNC_SIG_TRANSFER) {
            address to = address(uint160(state.mem.load(inOffset + 4)));
            uint value = state.mem.load(inOffset + 24);
            // TODO:
            // if the function is `transfer()`, then the `from` would be the signer of the inputs (recovered from r, v, s)
            // requirements:
            // - token address must be in input
            // - must have enough value
            // - must check color
            // - if ok : insert output : else invalid execution?

            state.stack.push(1);
            return abi.encode(["bool"], [true]);
        }

        // TODO: ERC721, ERC1948, allowance stuff

        // invalid - call fails
        state.stack.push(0);
        return "";
    }

    /*
     * This is used to by solc to check if a address is indeed a contract (has code).
     */
    function handleEXTCODESIZE(EVM memory state) internal {
        // TODO: check the address
        state.stack.pop();

        // return non-zero length to signal ok
        state.stack.push(1);
    }
}
