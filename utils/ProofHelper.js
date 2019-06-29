const Merkelizer = require('./Merkelizer');

const OP = require('./constants');
module.exports = class ProofHelper {
  /**
   * fullCode is a hex string
   */
  static constructProof (computationPath, fullCode) {
    const prevOutput = computationPath.left.executionState;
    const execState = computationPath.right.executionState;

    console.log('PrevOutput', prevOutput);
    let code = prevOutput.rawCodes.slice();
    let codeProof = [];
    console.log('Code Length', code.length);
    for (let i = 0; i < code.length; i++) {
      console.log('Ci', code[i]);
      codeProof.push(Merkelizer.hashProof(code[i].pos, Merkelizer.fragmentCode(fullCode)));
      console.log('Ci', code[i]);
    }
    console.log('Code Proof', codeProof);
    while (code.length < 50) code.push({ pos: 0, value: 0 });

    const proofs = {
      stackHash: Merkelizer.stackHash(
        prevOutput.stack.slice(0, prevOutput.stack.length - execState.compactStack.length)
      ),
      memHash: execState.isMemoryRequired ? OP.ZERO_HASH : Merkelizer.memHash(prevOutput.mem),
      dataHash: execState.isCallDataRequired ? OP.ZERO_HASH : Merkelizer.dataHash(prevOutput.data),
      codeProof,
      // TODO put code proof here
    };

    return {
      proofs,
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
      },
    };
  }
};
