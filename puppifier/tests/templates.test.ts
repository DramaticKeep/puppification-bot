import { expect } from 'chai';
import { createRandom } from '../src/random.ts';
import { pickTemplate, TEMPLATES, type Template } from '../src/templates.ts';

describe('pickTemplate', () => {
  it('never returns a template above the current intensity', () => {
    const { random } = createRandom(11);
    for (let i = 0; i < 200; i++) {
      const t = pickTemplate(0.0, random);
      expect((t.minIntensity ?? 0) <= 0.0).to.equal(true);
    }
  });

  it('eventually returns each template at sufficient intensity', () => {
    const { random } = createRandom(2026);
    const seen = new Set<string>();
    for (let i = 0; i < 800; i++) {
      const t = pickTemplate(1, random);
      seen.add(t.slots.join('|'));
    }
    for (const tpl of TEMPLATES) {
      expect(seen.has(tpl.slots.join('|'))).to.equal(
        true,
        `expected to see template [${tpl.slots.join(', ')}]`,
      );
    }
  });

  it('falls back to single-sound when no template is eligible', () => {
    const onlyHigh: Template[] = [
      { slots: ['sound', 'action'], weight: 1, minIntensity: 0.9 },
    ];
    const { random } = createRandom(1);
    const t = pickTemplate(0.1, random, onlyHigh);
    expect(t.slots).to.deep.equal(['sound']);
  });

  it('weighted distribution roughly reflects template weights', () => {
    const tpls: Template[] = [
      { slots: ['sound'], weight: 1 },
      { slots: ['action'], weight: 9 },
    ];
    const { random } = createRandom(99);
    let actionCount = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const t = pickTemplate(1, random, tpls);
      if (t.slots[0] === 'action') actionCount++;
    }
    expect(actionCount / N).to.be.greaterThan(0.85);
    expect(actionCount / N).to.be.below(0.95);
  });
});
