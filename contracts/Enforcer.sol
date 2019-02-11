pragma solidity ^0.5.2;
pragma experimental ABIEncoderV2;

import "./Verifier.sol";
import "./Merkelizer.slb";


contract Enforcer {

    uint256 public challengePeriod;
    uint256 public bondAmount;
    Verifier public verifier;

    struct Execution {
        uint256 startBlock;
        bytes32 endHash;
        uint256 executionLength;
        address solver;
    }

    mapping(bytes32 => Execution) public executions;
    mapping(address => uint256) public bonds;

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyVerifier() {
        require(msg.sender == address(verifier));
        _;
    }

    event Registered(bytes32 indexed executionId, address indexed solver, address codeContractAddress, bytes _callData);
    event DisputeInitialised(bytes32 indexed disputeId, bytes32 indexed executionId);
    event Slashed(bytes32 indexed executionId, address indexed _address);

    constructor(address _verifier, uint256 _challengePeriod, uint256 _bondAmount) public {
        verifier = Verifier(_verifier);
        challengePeriod = _challengePeriod;
        bondAmount = _bondAmount;
    }

    // register a new execution
    function register(address codeContractAddress, bytes memory _callData, bytes32 endHash, uint256 executionLength)
        public payable
    {
        require(msg.value == bondAmount);

        bytes32 executionId = keccak256(abi.encodePacked(codeContractAddress, _callData));

        require(executions[executionId].startBlock == 0);
        executions[executionId] = Execution(block.number, endHash, executionLength, msg.sender);
        bonds[msg.sender] += bondAmount;

        emit Registered(executionId, msg.sender, codeContractAddress, _callData);
    }

    // starts a new dispute
    function dispute(address codeContractAddress, bytes memory _callData, bytes32 endHash)
        public payable
    {
        bytes32 executionId = keccak256(abi.encodePacked(codeContractAddress, _callData));

        Execution storage execution = executions[executionId];

        require(execution.startBlock != 0);
        require(execution.startBlock + challengePeriod > block.number);
        require(msg.value == bondAmount);
        // Do we want to prohibit early?
        // require(execution.endHash != endHash);

        bonds[msg.sender] += bondAmount;

        bytes32 disputeId = verifier.initGame(
            executionId,
            Merkelizer.initialStateHash(_callData),
            execution.endHash,
            execution.executionLength,
            endHash,
            // challenger
            msg.sender,
            codeContractAddress
        );

        emit DisputeInitialised(disputeId, executionId);
    }

    // receive result from Verifier contract
    function result(bytes32 executionId, bool solverWon, address challenger) public onlyVerifier() {
        require(executions[executionId].startBlock != 0);
        require(executions[executionId].startBlock + challengePeriod > block.number);

        if (solverWon) {
            // slash deposit of challenger
            bonds[challenger] -= bondAmount;
            emit Slashed(executionId, challenger);
        } else {
            // slash deposit of solver
            bonds[executions[executionId].solver] -= bondAmount;
            emit Slashed(executionId, executions[executionId].solver);
            // delete execution
            delete executions[executionId];
        }

        bool success = address(0).send(bondAmount);
        require(success == true);
    }
}
