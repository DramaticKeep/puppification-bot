import type {
  Classifier,
  PhraseEmotionClassification,
  ToneScore,
} from 'emotion-classifier';

/**
 * The 28 GoEmotions labels. Mirrors the constant in
 * `emotion-classifier/tests/helpers.ts` so we don't depend on its test
 * surface (which isn't published).
 */
export const GO_EMOTIONS_LABELS = [
  'admiration',
  'amusement',
  'anger',
  'annoyance',
  'approval',
  'caring',
  'confusion',
  'curiosity',
  'desire',
  'disappointment',
  'disapproval',
  'disgust',
  'embarrassment',
  'excitement',
  'fear',
  'gratitude',
  'grief',
  'joy',
  'love',
  'nervousness',
  'optimism',
  'pride',
  'realization',
  'relief',
  'remorse',
  'sadness',
  'surprise',
  'neutral',
] as const;

export type GoEmotionsLabel = (typeof GO_EMOTIONS_LABELS)[number];

/**
 * Build a 28-entry tone vector. Any labels passed in `overrides` get the
 * specified score; all others default to `defaultScore` (0 by default).
 */
export function vector(
  overrides: Partial<Record<GoEmotionsLabel, number>> = {},
  defaultScore = 0,
): ToneScore[] {
  return GO_EMOTIONS_LABELS.map((label) => ({
    label,
    score: overrides[label] ?? defaultScore,
  }));
}

/**
 * Take the top-K scoring labels from a 28-vector, sorted desc by score
 * (matches the emotion-classifier output shape).
 */
export function topK(vec: ToneScore[], k: number): ToneScore[] {
  return [...vec].sort((a, b) => b.score - a.score).slice(0, k);
}

export interface FakeClassifierConfig {
  /** Map from input text to the FULL 28-label vector for that input. */
  vectorsByText?: Record<string, ToneScore[]>;
  /** Map from input text to a token count. Defaults to text length. */
  tokenLengths?: Record<string, number>;
  /** Default 28-vector for inputs absent from `vectorsByText`. */
  defaultVector?: ToneScore[];
}

export interface FakeClassifier extends Classifier {
  classifyOneCalls: string[];
  classifyManyCalls: string[][];
  tokenLengthCalls: string[];
}

export function makeFakeClassifier(
  config: FakeClassifierConfig = {},
): FakeClassifier {
  const vectorsByText = config.vectorsByText ?? {};
  const tokenLengths = config.tokenLengths ?? {};
  const fallback = config.defaultVector ?? vector({ neutral: 0.5 });

  const fake: FakeClassifier = {
    classifyOneCalls: [],
    classifyManyCalls: [],
    tokenLengthCalls: [],
    async classifyOne(text) {
      fake.classifyOneCalls.push(text);
      return vectorsByText[text] ?? fallback;
    },
    async classifyMany(texts) {
      fake.classifyManyCalls.push([...texts]);
      return texts.map((t) => vectorsByText[t] ?? fallback);
    },
    async tokenLength(text) {
      fake.tokenLengthCalls.push(text);
      return tokenLengths[text] ?? text.length;
    },
  };
  return fake;
}

/**
 * A classifier that throws if any of its methods are called. Used to
 * assert that the `_classification` entry points never invoke the
 * classifier.
 */
export function makeThrowingClassifier(): Classifier {
  return {
    async classifyOne() {
      throw new Error('throwingFake: classifyOne should not be called');
    },
    async classifyMany() {
      throw new Error('throwingFake: classifyMany should not be called');
    },
    async tokenLength() {
      throw new Error('throwingFake: tokenLength should not be called');
    },
  };
}

/**
 * Construct a `PhraseEmotionClassification` literal from already-tonal
 * sentences. Each entry's `vec` should already be a top-K vector
 * (sorted desc) — the test helpers never auto-trim.
 */
export function classification(
  phraseText: string,
  phraseTone: ToneScore[],
  sentences: Array<{ text: string; tone: ToneScore[] }>,
): PhraseEmotionClassification {
  return {
    phrase: { text: phraseText, tone: phraseTone },
    sentences: sentences.map((s) => ({ text: s.text, tone: s.tone })),
  };
}
