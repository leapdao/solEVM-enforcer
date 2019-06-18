# Merkelizer Explained

Our execution steps:
[executionState 0, executionState 1, executionState 2, ...]

For each `executionState`, we have a `stateHash` which references back
to the previous `executionState`. This is done via compact proofs.


Let's construct our tree with 6 executionStates; aka 'execution steps';
So we end up with [stateHash0, stateHash1, stateHash2, stateHash3, stateHash4, stateHash5]
Note:
  We assume power of 2 here, so we pad with an empty state and the hash of such a empty state consists of zeros 0x000000....

If a prevLeaf doesn't exist (starting at 0), that leaf will have no `left` part,
and the `right` part going to be the `initialStateHash`,
aka; the known state before the first execution (code, callData, gasRemaining).

`prevLeaf = { right: initialState, hash: initialStateHash }`
```
[
  prevLeaf = { left: prevLeaf.right.hash, right: stateHash0, hash: hash(left, right) },
  prevLeaf = { left: prevLeaf.right.hash, right: stateHash1, hash: hash(left, right) },
  prevLeaf = { left: prevLeaf.right.hash, right: stateHash2, hash: hash(left, right) },
  prevLeaf = { left: prevLeaf.right.hash, right: stateHash3, hash: hash(left, right) },
  prevLeaf = { left: prevLeaf.right.hash, right: stateHash4, hash: hash(left, right) },
  prevLeaf = { left: prevLeaf.right.hash, right: stateHash5 , hash: hash(left, right) },
]
```
Fine, now we can build our tree until we are left with one node (=root)

solver:
 below: the nodes we just constructed above
 ```
 [ a192 (l:initialState r:ef8a) ]  [ e18a (l:ef8a r:77d9) ]  [ d87e (l:77d9 r:d5b2) ]  [ 3639 (l:d5b2 r:b2b2) ]  [ 02ed (l:b2b2 r:ddf7) ]  [ df38 (l:ddf7 r:67c9) ]
 [ 8b76 (l:a192 r:e18a) ]  [ 8a08 (l:d87e r:3639) ]  [ 49f9 (l:02ed r:df38) ]  [ 0000 (l:0000 r:0000) < padding]
 [ 3c2e (l:8b76 r:8a08) ]  [ 080d (l:49f9 r:0000) ]
 [ 3f61 (l:3c2e r:080d) ] < root node
```
challenger:
 below: the nodes we just constructed above
 ```
 [ a192 (l:initialState r:ef8a) ]  [ e18a (l:ef8a r:77d9) ]  [ d87e (l:77d9 r:d5b2) ]  [ 3639 (l:d5b2 r:b2b2) ]  [ e6a7 (l:b2b2 r:78bd) ]  [ a7ea (l:78bd r:67c9) ]
 [ 8b76 (l:a192 r:e18a) ]  [ 8a08 (l:d87e r:3639) ]  [ cf2d (l:e6a7 r:a7ea) ]  [ 0000 (l:0000 r:0000) < padding]
 [ 3c2e (l:8b76 r:8a08) ]  [ ebab (l:cf2d r:0000) ]
 [ 3d4a (l:3c2e r:ebab) ] < root node
```

Note: In this example the Solver is wrong.

Let's walk the path from root to leaves;
We always compare `left`, `right` from solver and challenger;
Both of them need to follow the path they do *not* agree on.
If they both have different `left` and `right` hashes, they should default to/follow left.

Note: Solver & Challenger can submit out of order in each 'round', but they have to wait for each other to go onto the next 'level'.

The goal here is to find the first disagreement.

Let's go:
  solver goes right from 3f61 to 080d
  challenger goes right from 3d4a to ebab

  solver goes left from 080d to 49f9
  challenger goes left from ebab to cf2d

  solver goes left from 49f9 to 02ed
  challenger goes left from cf2d to e6a7
**They reached their leaves**

Seems like they disagree on stateHash4(solver=ddf7, challenger=78bd) and they agree on stateHash3(b2b2).
Because we construct our leaf nodes with `left: prevLeaf.right.hash` / the previous the execution,
we end up with the knowledge of the point disagreement and a stateHash they agree on (left).

Note:
  In the event that they do not agree on any execution step, we enforce the left-most `stateHash` = `initialStateHash`.
  That way we have known starting point.

