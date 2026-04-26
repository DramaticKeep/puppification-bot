import { expect } from 'chai';
import { blendTones, LABEL_TO_PALETTE, PALETTE_KEYS } from '../src/tone.ts';
import { GO_EMOTIONS_LABELS, vector } from './helpers.ts';

describe('tone', () => {
  it('every GoEmotions label maps to a palette key', () => {
    for (const label of GO_EMOTIONS_LABELS) {
      const key = LABEL_TO_PALETTE[label];
      expect(key, `missing palette mapping for ${label}`).to.exist;
      expect(PALETTE_KEYS).to.include(key!);
    }
  });

  it('blendTones weights sum to 1 for non-empty input', () => {
    const v = [
      { label: 'joy', score: 0.6 },
      { label: 'admiration', score: 0.3 },
    ];
    const mix = blendTones(v);
    const sum = PALETTE_KEYS.reduce((s, k) => s + mix.weights[k], 0);
    expect(sum).to.be.closeTo(1, 1e-9);
    expect(mix.weights.highPositive).to.be.closeTo(0.6 / 0.9, 1e-9);
    expect(mix.weights.lowPositive).to.be.closeTo(0.3 / 0.9, 1e-9);
  });

  it('blendTones intensity equals the peak score', () => {
    const mix = blendTones([
      { label: 'fear', score: 0.7 },
      { label: 'anger', score: 0.3 },
    ]);
    expect(mix.intensity).to.equal(0.7);
  });

  it('empty / all-zero input yields neutral mix with intensity 0', () => {
    const empty = blendTones([]);
    expect(empty.weights.neutral).to.equal(1);
    expect(empty.intensity).to.equal(0);

    const allZero = blendTones(vector({}));
    expect(allZero.weights.neutral).to.equal(1);
    expect(allZero.intensity).to.equal(0);
  });

  it('unknown labels collapse to neutral', () => {
    const mix = blendTones([{ label: 'made_up_label', score: 0.5 }]);
    expect(mix.weights.neutral).to.equal(1);
  });
});
