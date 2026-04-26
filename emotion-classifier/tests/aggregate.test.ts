import { expect } from 'chai';
import { weightedAverage } from '../src/aggregate.js';
import { vector } from './helpers.js';

const TOL = 1e-9;

function scoreOf(vec: { label: string; score: number }[], label: string): number {
  const found = vec.find((t) => t.label === label);
  expect(found, `expected label ${label} in vector`).to.not.be.undefined;
  return found!.score;
}

describe('weightedAverage', () => {
  it('returns an empty array for no inputs', () => {
    expect(weightedAverage([])).to.deep.equal([]);
  });

  it('returns the single vector unchanged when given one input', () => {
    const v = vector({ joy: 0.9, anger: 0.1 });
    const result = weightedAverage([v]);
    expect(result).to.deep.equal(v);
  });

  it('averages two equal-weight vectors per label', () => {
    const a = vector({ joy: 1.0, anger: 0.0 });
    const b = vector({ joy: 0.0, anger: 1.0 });
    const result = weightedAverage([a, b]);
    expect(scoreOf(result, 'joy')).to.be.closeTo(0.5, TOL);
    expect(scoreOf(result, 'anger')).to.be.closeTo(0.5, TOL);
    expect(scoreOf(result, 'neutral')).to.be.closeTo(0.0, TOL);
  });

  it('uses provided weights to skew the result', () => {
    const a = vector({ joy: 1.0 });
    const b = vector({ joy: 0.0 });
    const result = weightedAverage([a, b], [3, 1]);
    expect(scoreOf(result, 'joy')).to.be.closeTo(0.75, TOL);
  });

  it('favors the longer sentence under length-weighting', () => {
    const short = vector({ sadness: 1.0 });
    const long = vector({ joy: 1.0 });
    const result = weightedAverage([short, long], [10, 90]);
    expect(scoreOf(result, 'joy')).to.be.closeTo(0.9, TOL);
    expect(scoreOf(result, 'sadness')).to.be.closeTo(0.1, TOL);
  });

  it('preserves the label set from the first input vector', () => {
    const a = vector({ joy: 0.5 });
    const b = vector({ anger: 0.5 });
    const result = weightedAverage([a, b]);
    expect(result.map((t) => t.label)).to.deep.equal(a.map((t) => t.label));
  });

  it('throws when weights and inputs have different lengths', () => {
    const a = vector({ joy: 1.0 });
    expect(() => weightedAverage([a], [1, 2])).to.throw(/weights length/);
  });

  it('returns an empty array when all weights are zero', () => {
    const a = vector({ joy: 1.0 });
    const b = vector({ anger: 1.0 });
    expect(weightedAverage([a, b], [0, 0])).to.deep.equal([]);
  });

  it('treats negative weights as zero', () => {
    const a = vector({ joy: 1.0 });
    const b = vector({ joy: 0.0 });
    const result = weightedAverage([a, b], [-5, 1]);
    expect(scoreOf(result, 'joy')).to.be.closeTo(0.0, TOL);
  });
});
