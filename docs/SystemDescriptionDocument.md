# Overview
The goal of this project is to verify off-chain EVM computation on-chain.
In our particular case, it is used to correctly exit spending conditions from a side-chain to the main-chain
and also a means of a PoS mechanism to secure the side-chain.

Executing a program consists of many intermediate steps and in turn,
the EVM consists of various elements which change their data after each single step (opcode) of the program.
These intermediate states can be compared in an deterministic manner, by hashing the state of the EVM’s elements into a single state hash.
This makes it possible to construct a merkle tree from all those state hashes, each one of them representing a single execution step.

To find the first convergence of the execution (the first mismatch), we start a round-based path walking,
starting from the merkle root until we reach the leaves.

For more information on how this works, take a look at [Merkelizer.md](./Merkelizer.md).

## Example
Let us assume a solver registers a execution result given the `code` to the program, any inputs (`callData`) and the merkle root hash of the execution.
A Verifier can now execute this program and compare if both merkle root hashes are the same.
If the root hash are the same then both have the same result, if not, the Verifier can challenge the solver.


# Actors

## Solver
The solver registers execution result with the `Enforcer` contract.
This is a requirement if the solver wants to exit a spending condition to the main-chain.

## Verifier / Challenger
Potential verifiers can watch execution registrations and validate those off-chain.
If the off-chain result does not match the on-chain result, the validator is free to open a dispute, becoming a challenger.


# Incentivisation - Bonds

## Solver
The solver is incentified because this is a requirement to exit the spending condition to main-chain.
For every registered execution, the solver also needs to attach it with a bond.
If the solver gets challenged and wins, solver owns the bond of the challenger.
(Challenger's bond is slashed)

If the solver's execution result does not get challenged in a given challenge period, the execution is assumed as valid.
In the other case, if the solver does stop playing the verification game and the game is reaching the challenge period,
the solver will automatically lose (`claimTimeout`).

## Verifier
The verifier is incentified for the very fact that proving a execution wrong, the verifier gets the bond of the solver.
(Solver's bond is slashed)

If the challenger opens a dispute and stops playing the verification game, the solver will automatically win this dispute
if the challenge reaches the challenge period (`claimTimeout`).

## Notes
Anyone who is aware of the computation path can play a particular challenge.
That means it is not pegged to any address, except for the bonds.


# Contracts / Classes - Inheritance

```
--------------------------------------------------------------------------------
  { Accounts Constants Memory Stack Utils Code Logs Storage }
                            |
                        EVMRuntime
                            |
            HydratedRuntime - Supporting proofs
                            |
      Interceptor - opcode handlers overwritten to support SpendingConditions
                            |
                   Verifier - Verification Game

  Enforcer - Execution registration and handling of bonds

--------------------------------------------------------------------------------
```
