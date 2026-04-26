import { expect } from 'chai';
import {
  get_phrase_emotion_classification,
  getPhraseEmotionClassification,
} from '../src/index.ts';
import { makeFakeClassifier, vector } from './helpers.ts';

const TOL = 1e-9;

describe('get_phrase_emotion_classification', () => {
  it('returns the spec JSON shape with phrase + per-sentence tones', async () => {
    const text = 'I am ecstatic! I got a promotion.';
    const classifier = makeFakeClassifier({
      vectorsByText: {
        [text]: vector({ excitement: 0.8, joy: 0.5, admiration: 0.1 }),
        'I am ecstatic!': vector({ excitement: 0.95, joy: 0.4, approval: 0.05 }),
        'I got a promotion.': vector({ admiration: 0.6, joy: 0.5, pride: 0.3 }),
      },
    });

    const result = await get_phrase_emotion_classification(text, { classifier });

    expect(result).to.have.property('phrase');
    expect(result).to.have.property('sentences');
    expect(result.phrase.text).to.equal(text);
    expect(result.sentences.map((s) => s.text)).to.deep.equal([
      'I am ecstatic!',
      'I got a promotion.',
    ]);

    expect(result.phrase.tone).to.have.lengthOf(3);
    expect(result.phrase.tone[0]).to.deep.equal({ label: 'excitement', score: 0.8 });
    expect(result.phrase.tone[1]).to.deep.equal({ label: 'joy', score: 0.5 });
    expect(result.phrase.tone[2]).to.deep.equal({ label: 'admiration', score: 0.1 });

    expect(result.sentences[0]!.tone[0]).to.deep.equal({
      label: 'excitement',
      score: 0.95,
    });
    expect(result.sentences[1]!.tone[0]).to.deep.equal({
      label: 'admiration',
      score: 0.6,
    });
  });

  it('defaults topK to 3 and returns tones sorted by score descending', async () => {
    const classifier = makeFakeClassifier({
      defaultVector: vector({
        joy: 0.7,
        excitement: 0.5,
        admiration: 0.3,
        approval: 0.2,
        neutral: 0.1,
      }),
    });

    const result = await get_phrase_emotion_classification('Anything goes.', {
      classifier,
    });

    expect(result.phrase.tone).to.have.lengthOf(3);
    expect(result.phrase.tone.map((t) => t.label)).to.deep.equal([
      'joy',
      'excitement',
      'admiration',
    ]);
    expect(result.phrase.tone.map((t) => t.score)).to.satisfy(
      (scores: number[]) => scores.every((s, i) => i === 0 || scores[i - 1]! >= s),
    );
  });

  it('honors a custom topK option', async () => {
    const classifier = makeFakeClassifier({
      defaultVector: vector({ joy: 0.9, anger: 0.1 }),
    });

    const result = await get_phrase_emotion_classification('Hi.', {
      classifier,
      topK: 1,
    });
    expect(result.phrase.tone).to.have.lengthOf(1);
    expect(result.phrase.tone[0]!.label).to.equal('joy');
    result.sentences.forEach((s) => {
      expect(s.tone).to.have.lengthOf(1);
    });
  });

  it('throws for non-positive topK', async () => {
    const classifier = makeFakeClassifier();
    let err: Error | undefined;
    try {
      await get_phrase_emotion_classification('Hi.', { classifier, topK: 0 });
    } catch (e) {
      err = e as Error;
    }
    expect(err, 'expected error').to.not.be.undefined;
    expect(err!.message).to.match(/topK/);
  });

  it('runs the model on the full text when within the token limit', async () => {
    const text = 'Short and sweet.';
    const classifier = makeFakeClassifier({
      vectorsByText: {
        [text]: vector({ joy: 0.99 }),
      },
      tokenLengths: { [text]: 10 },
    });

    const result = await get_phrase_emotion_classification(text, { classifier });

    expect(result.phrase.tone[0]).to.deep.equal({ label: 'joy', score: 0.99 });
    expect(classifier.classifyOneCalls).to.deep.equal([text]);
    expect(classifier.tokenLengthCalls).to.deep.equal([text]);
  });

  it('falls back to length-weighted aggregation when input exceeds the token limit', async () => {
    const text = 'First sentence here. A much longer second sentence wins.';
    // Make the longer sentence dominate by giving it joy=1, the short one anger=1.
    const classifier = makeFakeClassifier({
      vectorsByText: {
        'First sentence here.': vector({ anger: 1.0 }),
        'A much longer second sentence wins.': vector({ joy: 1.0 }),
      },
      tokenLengths: { [text]: 999 },
    });

    const result = await get_phrase_emotion_classification(text, { classifier });

    expect(classifier.classifyOneCalls).to.deep.equal(
      [],
      'classifyOne must NOT be called on the full text when over the token limit',
    );

    const joyScore = result.phrase.tone.find((t) => t.label === 'joy')?.score ?? 0;
    const angerScore =
      result.phrase.tone.find((t) => t.label === 'anger')?.score ?? 0;
    expect(joyScore).to.be.greaterThan(angerScore);

    // Exact length-weighted average: weights are character lengths.
    const w1 = 'First sentence here.'.length;
    const w2 = 'A much longer second sentence wins.'.length;
    const expectedJoy = w2 / (w1 + w2);
    expect(joyScore).to.be.closeTo(expectedJoy, TOL);
  });

  it('produces a single-entry sentences array for single-sentence input', async () => {
    const text = 'Just one sentence.';
    const classifier = makeFakeClassifier({
      vectorsByText: { [text]: vector({ neutral: 0.9 }) },
      tokenLengths: { [text]: 5 },
    });

    const result = await get_phrase_emotion_classification(text, { classifier });

    expect(result.sentences).to.have.lengthOf(1);
    expect(result.sentences[0]!.text).to.equal(text);
    expect(result.phrase.text).to.equal(text);
  });

  it('handles empty input by returning empty tones and no sentences', async () => {
    const classifier = makeFakeClassifier();
    const result = await get_phrase_emotion_classification('   ', { classifier });
    expect(result.phrase.text).to.equal('');
    expect(result.phrase.tone).to.deep.equal([]);
    expect(result.sentences).to.deep.equal([]);
    expect(classifier.classifyOneCalls).to.deep.equal([]);
    expect(classifier.classifyManyCalls).to.deep.equal([]);
  });

  it('exposes a camelCase alias that behaves identically', async () => {
    const text = 'Hello there.';
    const classifier = makeFakeClassifier({
      vectorsByText: { [text]: vector({ joy: 0.5 }) },
      tokenLengths: { [text]: 4 },
    });
    const a = await get_phrase_emotion_classification(text, { classifier });

    const classifier2 = makeFakeClassifier({
      vectorsByText: { [text]: vector({ joy: 0.5 }) },
      tokenLengths: { [text]: 4 },
    });
    const b = await getPhraseEmotionClassification(text, { classifier: classifier2 });

    expect(a).to.deep.equal(b);
  });
});
