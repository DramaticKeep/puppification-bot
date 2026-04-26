import { expect } from 'chai';
import { puppify } from '../../src/index.ts';

const HIGH_NEGATIVE_BASES = ['grr', 'rrgh', 'snarl', 'gnar'];
const LOW_NEGATIVE_BASES = ['awoo', 'hrmmm', 'mrrr', 'whine', 'ohhhh'];
const HIGH_POSITIVE_BASES = [
  'bark',
  'woof',
  'ruff',
  'yip',
  'yap',
  'arf',
  'boof',
];

function containsBase(text: string, bases: readonly string[]): boolean {
  // Sound bases are matched after morphology by collapsing repeated
  // letters (so `ruuuuff` collapses to `ruf`, which matches `ruff`'s
  // collapsed `ruf`).
  const collapse = (s: string) =>
    s.toLowerCase().replace(/(.)\1+/g, '$1');
  const haystack = collapse(text);
  return bases.some((b) => haystack.includes(collapse(b)));
}

describe('integration: end-to-end with the real GoEmotions model', function () {
  before(async function () {
    this.timeout(300000);
    // Warm the model so per-test latency reflects steady-state inference,
    // not first-time model download.
    await puppify('warmup', { seed: 0 });
  });

  it('produces a sensible result for a happy phrase with seed 1', async () => {
    const text = 'I am ecstatic! I got a promotion.';
    const result = await puppify(text, { seed: 1 });

    expect(result.text.length).to.be.greaterThan(0);
    expect(result.sentences).to.have.lengthOf(2);
    for (const s of result.sentences) {
      expect(s.dog.length).to.be.greaterThan(0);
    }
    // At least one *...* action phrase appears across the two sentences.
    expect(/\*[^*]+\*/.test(result.text)).to.equal(
      true,
      `expected at least one action phrase in: ${result.text}`,
    );
    expect(result.seed).to.equal(1);
  });

  it('the same seed reproduces the same translation byte-for-byte', async () => {
    const text = 'I am ecstatic! I got a promotion.';
    const a = await puppify(text, { seed: 1 });
    const b = await puppify(text, { seed: 1 });
    expect(a.text).to.equal(b.text);
    expect(a.sentences.map((s) => s.dog)).to.deep.equal(
      b.sentences.map((s) => s.dog),
    );
  });

  it('an angry phrase contains a high-negative palette base', async () => {
    const text = "I'm so angry I could scream!";
    let found = false;
    for (let seed = 0; seed < 10 && !found; seed++) {
      const r = await puppify(text, { seed });
      if (containsBase(r.text, HIGH_NEGATIVE_BASES)) found = true;
    }
    expect(found).to.equal(
      true,
      'expected at least one high-negative base across 10 seeds',
    );
  });

  it('a sad phrase contains a low-negative palette base', async () => {
    const text = 'I am so sad and lonely today.';
    let found = false;
    for (let seed = 0; seed < 10 && !found; seed++) {
      const r = await puppify(text, { seed });
      if (containsBase(r.text, LOW_NEGATIVE_BASES)) found = true;
    }
    expect(found).to.equal(
      true,
      'expected at least one low-negative base across 10 seeds',
    );
  });

  it('a happy phrase contains a high-positive palette base', async () => {
    const text = 'I am thrilled and overjoyed!';
    let found = false;
    for (let seed = 0; seed < 10 && !found; seed++) {
      const r = await puppify(text, { seed });
      if (containsBase(r.text, HIGH_POSITIVE_BASES)) found = true;
    }
    expect(found).to.equal(
      true,
      'expected at least one high-positive base across 10 seeds',
    );
  });

  it('the easter egg "good boy" survives full classify -> render pipeline', async () => {
    const r = await puppify('good boy', { seed: 99 });
    expect(r.text).to.equal('BARK BARK BARK! *spins in a circle*');
  });
});
