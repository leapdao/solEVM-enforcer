const Merkelizer = require('./Merkelizer');

const OP = require('./constants');
module.exports = class ProofHelper {
  static constructProof (computationPath) {
    const prevOutput = computationPath.left.executionState;
    const execState = computationPath.right.executionState;
    const proofs = {
      stackHash: Merkelizer.stackHash(
        prevOutput.stack.slice(0, prevOutput.stack.length - execState.compactStack.length)
      ),
      memHash: execState.isMemoryRequired ? OP.ZERO_HASH : Merkelizer.memHash(prevOutput.mem),
      dataHash: execState.isCallDataRequired ? OP.ZERO_HASH : Merkelizer.dataHash(prevOutput.data),
      // TODO put code proof here
    };

    console.log('PrevOutput', prevOutput);
    let code = prevOutput.rawCodes.slice();
    while (code.length < 50) code.push({ pos: 0, value: 0 });

    return {
      proofs,
      executionInput: {
        data: (execState.isCallDataRequired ? prevOutput.data : '0x'),
        stack: execState.compactStack,
        mem: execState.isMemoryRequired ? prevOutput.mem : [],
        customEnvironmentHash: OP.ZERO_HASH,
        returnData: prevOutput.returnData,
        pc: prevOutput.pc,
        gasRemaining: prevOutput.gasRemaining,
        stackSize: prevOutput.stackSize,
        memSize: prevOutput.memSize,
        code,
        codeLength: prevOutput.codeLength,
        codeFragLength: prevOutput.codeFragLength,
      },
    };
  }
};
