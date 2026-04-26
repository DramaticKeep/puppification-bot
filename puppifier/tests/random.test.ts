import { expect } from 'chai';
import { createRandom } from '../src/random.ts';

describe('createRandom', () => {
  it('produces the same sequence given the same numeric seed', () => {
    const a = createRandom(42).random;
    const b = createRandom(42).random;
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).to.deep.equal(seqB);
  });

  it('produces different sequences for different numeric seeds', () => {
    const a = createRandom(1).random;
    const b = createRandom(2).random;
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).to.not.deep.equal(seqB);
  });

  it('hashes string seeds deterministically (same string -> same sequence)', () => {
    const a = createRandom('hello').random;
    const b = createRandom('hello').random;
    expect(a.next()).to.equal(b.next());
    expect(a.next()).to.equal(b.next());
  });

  it('hashes different string seeds to different sequences', () => {
    const a = createRandom('abc').random;
    const b = createRandom('abd').random;
    const valA = Array.from({ length: 5 }, () => a.next()).join(',');
    const valB = Array.from({ length: 5 }, () => b.next()).join(',');
    expect(valA).to.not.equal(valB);
  });

  it('returns the resolved numeric seed alongside random()', () => {
    const r = createRandom(7);
    expect(r.seed).to.equal(7);
    const s = createRandom('seedy');
    expect(typeof s.seed).to.equal('number');
    expect(Number.isInteger(s.seed)).to.equal(true);
  });

  it('next() returns floats in [0, 1)', () => {
    const { random } = createRandom(123);
    for (let i = 0; i < 100; i++) {
      const v = random.next();
      expect(v).to.be.at.least(0);
      expect(v).to.be.below(1);
    }
  });

  it('int() respects inclusive bounds', () => {
    const { random } = createRandom(123);
    for (let i = 0; i < 200; i++) {
      const v = random.int(2, 5);
      expect(v).to.be.at.least(2);
      expect(v).to.be.at.most(5);
      expect(Number.isInteger(v)).to.equal(true);
    }
  });

  it('pick() throws on empty array', () => {
    const { random } = createRandom(0);
    expect(() => random.pick([])).to.throw(/empty/);
  });

  it('pickWeighted() never picks zero-weight items unless all weights are zero', () => {
    const { random } = createRandom(99);
    const items = ['a', 'b', 'c'];
    const weights = [1, 0, 1];
    const picks = new Set<string>();
    for (let i = 0; i < 200; i++) picks.add(random.pickWeighted(items, weights));
    expect(picks.has('b')).to.equal(false);
    expect(picks.has('a') || picks.has('c')).to.equal(true);
  });

  it('pickWeighted() falls back to uniform when all weights are zero', () => {
    const { random } = createRandom(99);
    const items = ['x', 'y', 'z'];
    const counts: Record<string, number> = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 600; i++) counts[random.pickWeighted(items, [0, 0, 0])]!++;
    expect(counts['x']).to.be.greaterThan(0);
    expect(counts['y']).to.be.greaterThan(0);
    expect(counts['z']).to.be.greaterThan(0);
  });

  it('pickWeighted() approximately honors weights', () => {
    const { random } = createRandom(2026);
    const items = ['heavy', 'light'];
    const weights = [9, 1];
    let heavy = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) {
      if (random.pickWeighted(items, weights) === 'heavy') heavy++;
    }
    const ratio = heavy / N;
    expect(ratio).to.be.greaterThan(0.85);
    expect(ratio).to.be.below(0.95);
  });

  it('pickWeighted() throws on arity mismatch', () => {
    const { random } = createRandom(0);
    expect(() => random.pickWeighted(['a', 'b'], [1])).to.throw(/arity/);
  });

  it('bool(0) is always false; bool(1) is always true', () => {
    const { random } = createRandom(11);
    for (let i = 0; i < 50; i++) {
      expect(random.bool(0)).to.equal(false);
      expect(random.bool(1)).to.equal(true);
    }
  });

  it('bool(p) approximately matches p over many draws', () => {
    const { random } = createRandom(31337);
    let trues = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) if (random.bool(0.3)) trues++;
    const ratio = trues / N;
    expect(ratio).to.be.greaterThan(0.25);
    expect(ratio).to.be.below(0.35);
  });

  it('shuffle() preserves the multiset of items', () => {
    const { random } = createRandom(7);
    const input = [1, 2, 3, 4, 5];
    const shuffled = random.shuffle(input);
    expect(shuffled).to.have.lengthOf(input.length);
    expect([...shuffled].sort()).to.deep.equal([...input].sort());
  });

  it('shuffle() does not mutate input', () => {
    const { random } = createRandom(7);
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    random.shuffle(input);
    expect(input).to.deep.equal(copy);
  });
});
