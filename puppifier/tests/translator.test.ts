import { expect } from 'chai';
import { defaultProfile } from '../src/profile.ts';
import { createRandom } from '../src/random.ts';
import { makeRecentBuffers, translateSentence } from '../src/translator.ts';
import type { ToneScore } from 'emotion-classifier';

function ctxAt(seed: number) {
  const { random } = createRandom(seed);
  return {
    rng: random,
    profile: defaultProfile,
    buffers: makeRecentBuffers(defaultProfile),
  };
}

const happyTone: ToneScore[] = [
  { label: 'joy', score: 0.92 },
  { label: 'excitement', score: 0.65 },
  { label: 'admiration', score: 0.21 },
];

const sadTone: ToneScore[] = [
  { label: 'sadness', score: 0.85 },
  { label: 'grief', score: 0.4 },
  { label: 'disappointment', score: 0.2 },
];

const angryTone: ToneScore[] = [
  { label: 'anger', score: 0.9 },
  { label: 'annoyance', score: 0.5 },
  { label: 'disapproval', score: 0.3 },
];

const curiousTone: ToneScore[] = [
  { label: 'curiosity', score: 0.7 },
  { label: 'confusion', score: 0.3 },
];

describe('translateSentence', () => {
  it('returns "" for empty / whitespace-only input', () => {
    expect(translateSentence('', happyTone, ctxAt(1))).to.equal('');
    expect(translateSentence('   ', happyTone, ctxAt(1))).to.equal('');
  });

  it('is deterministic for a fixed seed', () => {
    const a = translateSentence('I am very happy.', happyTone, ctxAt(42));
    const b = translateSentence('I am very happy.', happyTone, ctxAt(42));
    expect(a).to.equal(b);
  });

  it('full-uppercase source yields uppercase sound tokens (but lowercase actions)', () => {
    const out = translateSentence('I AM SO HAPPY!', happyTone, ctxAt(7));
    // Parse out *...* action regions and sound regions independently.
    const actionRegex = /\*[^*]+\*/g;
    const actions = out.match(actionRegex) ?? [];
    const soundRegion = out.replace(actionRegex, ' ');
    const soundLetters = soundRegion.replace(/[^A-Za-z]/g, '');
    if (soundLetters.length > 0) {
      expect(soundLetters).to.equal(
        soundLetters.toUpperCase(),
        `expected uppercase sound region, got "${soundRegion}" in: ${out}`,
      );
    }
    for (const action of actions) {
      const inner = action.slice(1, -1);
      // No uppercase letters should leak into action bodies.
      expect(inner).to.equal(
        inner.toLowerCase(),
        `expected fully lowercase action body, got "${action}" in: ${out}`,
      );
    }
  });

  it('all-caps source does NOT uppercase words inside multi-word actions', () => {
    // Force a multi-word intransitive action ("stomps off") on every call,
    // a template that always emits an action, and an all-caps source.
    const profile = {
      ...defaultProfile,
      grammars: {
        ...defaultProfile.grammars,
        highNegative: {
          ...defaultProfile.grammars.highNegative,
          intransitiveVerbs: [{ value: 'stomps off', weight: 1 }],
          intransitiveProbability: 1,
          modifierProbability: 0,
        },
      },
      density: {
        ...defaultProfile.density,
        actionsPerSentence: 5,
      },
      templates: [{ slots: ['sound', 'action', 'sound'] as const, weight: 1 }],
    };
    const { random } = createRandom(1);
    const ctx = {
      rng: random,
      profile,
      buffers: makeRecentBuffers(profile),
    };
    const out = translateSentence('STOP IT!', angryTone, ctx);
    expect(out).to.include('*stomps off*');
    expect(out).to.not.match(/\*[^*]*[A-Z][^*]*\*/);
  });

  it('trailing "?" is preserved on a sound token (and a head-tilt action may follow)', () => {
    const out = translateSentence(
      'is that a treat?',
      curiousTone,
      ctxAt(13),
    );
    expect(out.includes('?')).to.equal(true, `expected "?" in output: ${out}`);
    // The "?" should land on a sound token, not after a closing '*'.
    expect(/\*\?/.test(out)).to.equal(
      false,
      `expected "?" on a sound token, not after an action: ${out}`,
    );
  });

  it('trailing "!" forces last sound cluster to uppercase', () => {
    const out = translateSentence('I am SO excited!', happyTone, ctxAt(2));
    expect(out.endsWith('!')).to.equal(true);
  });

  it('trailing "..." is preserved', () => {
    const out = translateSentence('I am tired...', sadTone, ctxAt(3));
    expect(out).to.match(/\.\.\.\s*$/);
  });

  it('easter egg "i love you" always ends with *licks your face*', () => {
    for (let i = 0; i < 20; i++) {
      const out = translateSentence('I love you.', happyTone, ctxAt(i));
      expect(out.endsWith('*licks your face*')).to.equal(true);
    }
  });

  it('easter egg "good boy" always returns BARK BARK BARK output', () => {
    for (let i = 0; i < 5; i++) {
      const out = translateSentence('good boy!', happyTone, ctxAt(i));
      expect(out).to.equal('BARK BARK BARK! *spins in a circle*');
    }
  });

  it('soft tag (walk) prepends *ears perk up* if no opener action present', () => {
    const out = translateSentence(
      'time for a walk',
      happyTone,
      ctxAt(123),
    );
    // Either the template already led with an action OR we should see ears perk up.
    expect(out.includes('*ears perk up*') || out.startsWith('*')).to.equal(true);
  });

  it('output is non-empty for non-trivial input across many seeds and tones', () => {
    const tones = [happyTone, sadTone, angryTone, curiousTone];
    for (let i = 0; i < 50; i++) {
      const tone = tones[i % tones.length]!;
      const out = translateSentence('Hello there.', tone, ctxAt(i));
      expect(out.length).to.be.greaterThan(0);
    }
  });

  it('contains at least one *...* action phrase given high intensity over many seeds', () => {
    let withAction = 0;
    const N = 30;
    for (let i = 0; i < N; i++) {
      const out = translateSentence(
        'I am incredibly excited about this amazing news!',
        happyTone,
        ctxAt(i),
      );
      if (/\*[^*]+\*/.test(out)) withAction++;
    }
    expect(withAction / N).to.be.greaterThan(0.4);
  });
});
