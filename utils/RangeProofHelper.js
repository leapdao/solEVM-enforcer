'use strict';

module.exports = class RangeProofHelper {
  constructor (mem) {
    const self = this;

    const handler = {
      get: function (obj, prop) {
        if (prop === 'slice') {
          return this.slice;
        }

        const x = parseInt(prop);
        if (Number.isInteger(x)) {
          if (x < self.readLow || self.readLow === -1) {
            self.readLow = x;
          }
          if (x > self.readHigh || self.readHigh === -1) {
            self.readHigh = x;
          }
          if (self.readAndWrites.indexOf(x) === -1) {
            self.readAndWrites.push(x);
          }
        }

        return obj[prop];
      },

      set: function (obj, prop, val) {
        obj[prop] = val;

        const x = parseInt(prop);
        if (Number.isInteger(x)) {
          if (x < self.writeLow || self.writeLow === -1) {
            self.writeLow = x;
          }
          if (x > self.writeHigh || self.writeHigh === -1) {
            self.writeHigh = x;
          }
          if (self.readAndWrites.indexOf(x) === -1) {
            self.readAndWrites.push(x);
          }
        }

        return true;
      },

      slice: function (a, b) {
        for (let i = a; i < b; i++) {
          if (self.readAndWrites.indexOf(i) === -1) {
            self.readAndWrites.push(i);
          }
        }
        if (a < self.readLow || self.readLow === -1) {
          self.readLow = a;
        }
        if (b > self.readHigh || self.readHigh === -1) {
          self.readHigh = b;
        }
        return mem.slice(a, b);
      },
    };

    this.data = mem;
    this.proxy = new Proxy(mem, handler);
    this.reset();
  }

  reset () {
    this.readLow = -1;
    this.readHigh = -1;
    this.writeLow = -1;
    this.writeHigh = -1;
    this.readAndWrites = [];
  }
};
