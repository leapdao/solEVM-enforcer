const Merkelizer = require('./Merkelizer');

const OP = require('./constants');
module.exports = class ProofHelper {
  /**
   * fullCode is a hex string
   */
  static constructProof (computationPath, fullCode) {
    const prevOutput = computationPath.left.executionState;
    const execState = computationPath.right.executionState;

    let code = prevOutput.rawCodes.slice();
    let codeProofs = [];
    for (let i = 0; i < code.length; i++) {
      codeProofs = codeProofs.concat(Merkelizer.hashProof(code[i].pos, Merkelizer.fragmentCode(fullCode)));
    }
    let codeProofLength = codeProofs.length / code.length;
    // stub code
    while (code.length < 50) code.push({ pos: 0, value: 0 });

    const proofs = {
      stackHash: Merkelizer.stackHash(
        prevOutput.stack.slice(0, prevOutput.stack.length - execState.compactStack.length)
      ),
      memHash: execState.isMemoryRequired ? OP.ZERO_HASH : Merkelizer.memHash(prevOutput.mem),
      dataHash: execState.isCallDataRequired ? OP.ZERO_HASH : Merkelizer.dataHash(prevOutput.data),
    };

    return {
      proofs,
      codeProofs,
      executionInput: {
        // TODO don't know why but this suddenly failed
        // data: (execState.isCallDataRequired ? prevOutput.data : '0x'),
        data: prevOutput.data,
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
        codeProofLength,
      },
    };
  }
};
