import { expect } from 'chai';
import { defaultClassifier } from '../../src/classifier.js';
import {
  get_phrase_emotion_classification,
  type ToneScore,
} from '../../src/index.js';
import { GO_EMOTIONS_LABELS } from '../helpers.js';

const LABEL_SET = new Set<string>(GO_EMOTIONS_LABELS);

const POSITIVE_AFFECT = new Set([
  'joy',
  'excitement',
  'admiration',
  'amusement',
  'approval',
  'optimism',
  'pride',
  'gratitude',
  'love',
  'caring',
  'relief',
]);

const ANGRY_FAMILY = new Set([
  'anger',
  'annoyance',
  'disapproval',
  'disgust',
]);

/**
 * Centralizes structural invariants that every emitted tone array must satisfy:
 * - exactly `expectedLength` entries
 * - all labels are valid GoEmotions labels
 * - all scores are finite and within [0, 1]
 * - sorted strictly by score descending
 */
function assertValidTone(
  tone: ToneScore[],
  expectedLength: number,
): void {
  expect(tone, 'tone array').to.have.lengthOf(expectedLength);
  for (const t of tone) {
    expect(LABEL_SET.has(t.label), `unknown label: ${t.label}`).to.equal(true);
    expect(Number.isFinite(t.score), `score not finite: ${t.score}`).to.equal(true);
    expect(t.score).to.be.at.least(0);
    expect(t.score).to.be.at.most(1);
  }
  for (let i = 1; i < tone.length; i++) {
    expect(tone[i - 1]!.score).to.be.at.least(tone[i]!.score);
  }
}

describe('integration: real GoEmotions model', function () {
  before(async function () {
    this.timeout(300000);
    // Warm the singleton so per-test latency reflects steady-state inference,
    // not first-time model download.
    await defaultClassifier.classifyOne('warmup');
  });

  describe('defaultClassifier', () => {
    it('classifyOne returns a valid 28-label vector', async () => {
      const out = await defaultClassifier.classifyOne('Hello there.');
      expect(out).to.have.lengthOf(28);
      const seen = new Set<string>();
      for (const t of out) {
        expect(LABEL_SET.has(t.label), `unknown label: ${t.label}`).to.equal(true);
        expect(seen.has(t.label), `duplicate label: ${t.label}`).to.equal(false);
        seen.add(t.label);
        expect(Number.isFinite(t.score)).to.equal(true);
        expect(t.score).to.be.at.least(0);
        expect(t.score).to.be.at.most(1);
      }
    });

    it('tokenLength returns a positive integer for non-empty input', async () => {
      const n = await defaultClassifier.tokenLength('Hello there, how are you?');
      expect(n).to.be.a('number');
      expect(Number.isInteger(n)).to.equal(true);
      expect(n).to.be.greaterThan(0);
    });
  });

  describe('get_phrase_emotion_classification', () => {
    it('classifies a happy phrase with the expected shape and positive affect', async () => {
      const text = 'I am ecstatic! I got a promotion.';
      const result = await get_phrase_emotion_classification(text);

      expect(result.phrase.text).to.equal(text);
      assertValidTone(result.phrase.tone, 3);

      expect(result.sentences).to.have.lengthOf(2);
      expect(result.sentences[0]!.text).to.equal('I am ecstatic!');
      expect(result.sentences[1]!.text).to.equal('I got a promotion.');
      assertValidTone(result.sentences[0]!.tone, 3);
      assertValidTone(result.sentences[1]!.tone, 3);

      const phraseLabels = new Set(result.phrase.tone.map((t) => t.label));
      const overlapsPositive = [...phraseLabels].some((l) => POSITIVE_AFFECT.has(l));
      expect(
        overlapsPositive,
        `expected positive-affect label in phrase tone, got: ${[...phraseLabels].join(', ')}`,
      ).to.equal(true);
    });

    it('classifies an angry phrase with an anger-family label in the top-3', async () => {
      const text = "I'm so angry I could scream!";
      const result = await get_phrase_emotion_classification(text);

      assertValidTone(result.phrase.tone, 3);
      const labels = result.phrase.tone.map((t) => t.label);
      const overlapsAngry = labels.some((l) => ANGRY_FAMILY.has(l));
      expect(
        overlapsAngry,
        `expected anger-family label in phrase tone, got: ${labels.join(', ')}`,
      ).to.equal(true);
    });

    it('produces distinct top tones for sentences with opposing sentiments', async () => {
      const text = 'I love sunshine. I hate the rain.';
      const result = await get_phrase_emotion_classification(text);

      expect(result.sentences).to.have.lengthOf(2);
      const top0 = result.sentences[0]!.tone[0]!.label;
      const top1 = result.sentences[1]!.tone[0]!.label;
      expect(
        top0,
        `expected differing top tones across sentences but got "${top0}" twice`,
      ).to.not.equal(top1);
    });

    it('honors a custom topK while preserving sort and range invariants', async () => {
      const result = await get_phrase_emotion_classification('I am thrilled!', {
        topK: 5,
      });
      assertValidTone(result.phrase.tone, 5);
      result.sentences.forEach((s) => assertValidTone(s.tone, 5));
    });

    it('exercises the aggregation fallback for inputs longer than 512 tokens', async function () {
      this.timeout(60000);
      // Build a long enough input to exceed the model's 512-token context.
      const paragraph =
        'The quick brown fox jumps over the lazy dog. The early bird catches the worm. ' +
        'A stitch in time saves nine. Every cloud has a silver lining. ' +
        'Actions speak louder than words. Better late than never. ';
      let text = paragraph;
      while ((await defaultClassifier.tokenLength(text)) <= 512) {
        text += paragraph;
      }

      const result = await get_phrase_emotion_classification(text);

      assertValidTone(result.phrase.tone, 3);
      expect(result.sentences.length).to.be.greaterThan(1);
      result.sentences.forEach((s) => assertValidTone(s.tone, 3));
    });
  });
});
