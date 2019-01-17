const ethUtils = require('ethereumjs-util');

class MerkleTree {
  constructor (elements) {
    this.elements = elements;
    this.leafs = elements.map(x => this.hashFn(x));
    this.layers = this.getLayers(this.leafs);
  }

  getLayers (elements) {
    const layers = [];
    layers.push(elements);

    // Get next layer until we reach the root
    while (layers[layers.length - 1].length > 1) {
      layers.push(this.getNextLayer(layers[layers.length - 1]));
    }

    return layers;
  }

  getNextLayer (elements) {
    return elements.reduce((layer, el, idx, arr) => {
      if (idx % 2 === 0) {
        // Hash the current element with its pair element
        layer.push(this.combinedHash(el, arr[idx + 1]));
      }

      return layer;
    }, []);
  }

  combinedHash (first, second) {
    if (!second) { second = '0x0000000000000000000000000000000000000000000000000000000000000000'; }

    return this.hashFn(first + second.slice(2, 130));
  }

  hashFn (x) {
    let hash = ethUtils.keccak256(x);
    return '0x' + hash.toString('hex');
  }

  getRoot () {
    return this.layers[this.layers.length - 1][0];
  }

  getProof (element) {
    let idx = this.elements.indexOf(element);

    if (idx === -1) {
      throw new Error('Element does not exist in Merkle tree');
    }

    return this.layers.reduce((proof, layer) => {
      const pairElement = this.getPairElement(idx, layer);
      if (pairElement) {
        proof.push(pairElement);
      }
      idx = Math.floor(idx / 2);
      return proof;
    }, []);
  }

  getPairElement (idx, layer) {
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (pairIdx < layer.length) {
      return layer[pairIdx];
    } else {
      return null;
    }
  }
}

module.exports = MerkleTree;
