import { expect } from 'chai';
import {
  puppify,
  type PuppifyResult,
} from '../src/index.ts';
import { makeFakeClassifier, vector } from './helpers.ts';

/**
 * Normalize a sound token to a "surface key" by stripping non-letters
 * and lowercasing. We deliberately do NOT collapse repeated letters so
 * stretched forms (e.g. `ruuuff`) are distinct from their base (`ruff`)
 * and so two different palette entries that happen to share a collapsed
 * form (e.g. `grr` vs `grrr`) are distinguished.
 *
 * The 3-in-a-row check then flags only outputs where the same exact
 * surface form lands three times consecutively — which is what reads as
 * monotonous to a human.
 */
function normalizeToken(tok: string): string {
  return tok.replace(/[^A-Za-z]/g, '').toLowerCase();
}

function isActionToken(tok: string): boolean {
  return tok.startsWith('*') || tok.endsWith('*');
}

/**
 * Walk the output string, splitting on whitespace AND grouping `*...*`
 * action chunks together, returning the list of sound-token base keys.
 * Action chunks (and tokens inside them) are discarded.
 */
function extractSoundBases(text: string): string[] {
  const tokens = text.split(/\s+/).filter((t) => t.length > 0);
  const out: string[] = [];
  let inAction = false;
  for (const tok of tokens) {
    if (inAction) {
      if (tok.endsWith('*')) inAction = false;
      continue;
    }
    if (tok.startsWith('*')) {
      if (!tok.endsWith('*') || tok.length === 1) inAction = true;
      continue;
    }
    if (isActionToken(tok)) continue;
    const norm = normalizeToken(tok);
    if (norm.length > 0) out.push(norm);
  }
  return out;
}

interface Fixture {
  name: string;
  text: string;
  vec: ReturnType<typeof vector>;
  /** Higher minimum unique ratio; tune as palettes stabilize. */
  minUniqueRatio?: number;
  /** Distinct outputs out of 100. */
  minDistinctOutputs?: number;
  /** Distinct first-sentence dog strings out of 100. */
  minDistinctFirstSentences?: number;
}

const fixtures: Fixture[] = [
  {
    name: 'high-energy positive',
    text: 'I am so excited! I got a promotion!',
    vec: vector({ joy: 0.92, excitement: 0.65, admiration: 0.21 }),
  },
  {
    name: 'low-energy',
    text: 'I am quite tired.',
    vec: vector({ sadness: 0.6, disappointment: 0.3, neutral: 0.2 }),
  },
  {
    name: 'mixed valence',
    text: 'I love sunshine. I hate the rain.',
    vec: vector({ love: 0.5, anger: 0.5, annoyance: 0.4 }),
  },
];

describe('non-repetition (property tests)', () => {
  for (const fx of fixtures) {
    describe(fx.name, () => {
      const minUniqueRatio = fx.minUniqueRatio ?? 0.5;
      const minDistinctOutputs = fx.minDistinctOutputs ?? 80;
      const minDistinctFirstSentences = fx.minDistinctFirstSentences ?? 60;

      const N = 100;
      let results: PuppifyResult[] = [];

      before(async () => {
        const fake = makeFakeClassifier({ defaultVector: fx.vec });
        results = [];
        for (let i = 0; i < N; i++) {
          // Each iteration uses a fresh fake to keep per-call buffers
          // realistic and to avoid any stateful classifier interference.
          const r = await puppify(fx.text, { seed: i, classifier: fake });
          results.push(r);
        }
      });

      it(`mean per-output unique base-sound ratio >= ${minUniqueRatio}`, () => {
        let totalRatio = 0;
        let counted = 0;
        for (const r of results) {
          const bases = extractSoundBases(r.text);
          if (bases.length === 0) continue;
          const ratio = new Set(bases).size / bases.length;
          totalRatio += ratio;
          counted++;
        }
        expect(counted).to.be.greaterThan(0);
        const mean = totalRatio / counted;
        expect(mean).to.be.at.least(
          minUniqueRatio,
          `mean per-output unique-base ratio = ${mean.toFixed(3)} over ${counted} outputs`,
        );
      });

      it('palette coverage: at least 5 distinct base sounds appear across 100 outputs', () => {
        const seen = new Set<string>();
        for (const r of results) {
          for (const b of extractSoundBases(r.text)) seen.add(b);
        }
        expect(seen.size).to.be.at.least(
          5,
          `only saw ${seen.size} distinct base sounds: ${[...seen].join(', ')}`,
        );
      });

      it('no base sound appears 3+ times in a row in any single output', () => {
        for (const r of results) {
          const bases = extractSoundBases(r.text);
          for (let i = 0; i + 2 < bases.length; i++) {
            const a = bases[i]!;
            const b = bases[i + 1]!;
            const c = bases[i + 2]!;
            if (a === b && b === c) {
              throw new Error(
                `seed ${r.seed} produced 3-in-a-row "${a}":\n  ${r.text}`,
              );
            }
          }
        }
      });

      it(`distinct full outputs >= ${minDistinctOutputs} of ${N}`, () => {
        const distinct = new Set(results.map((r) => r.text)).size;
        expect(distinct).to.be.at.least(
          minDistinctOutputs,
          `only ${distinct} distinct outputs across ${N} seeds`,
        );
      });

      it(`distinct first-sentence dog strings >= ${minDistinctFirstSentences} of ${N}`, () => {
        const firsts = results.map((r) => r.sentences[0]?.dog ?? '');
        const distinct = new Set(firsts).size;
        expect(distinct).to.be.at.least(
          minDistinctFirstSentences,
          `only ${distinct} distinct first-sentence dog strings across ${N} seeds`,
        );
      });
    });
  }
});
