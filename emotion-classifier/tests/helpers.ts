import type { Classifier, ToneScore } from '../src/classifier.js';

/**
 * The 28 GoEmotions labels used by the upstream model. Tests reference this
 * to construct deterministic full-vector outputs.
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

/**
 * Build a 28-entry tone vector. Any labels passed in `overrides` get the
 * specified score; all others default to `defaultScore` (0 by default).
 */
export function vector(
  overrides: Partial<Record<(typeof GO_EMOTIONS_LABELS)[number], number>> = {},
  defaultScore = 0,
): ToneScore[] {
  return GO_EMOTIONS_LABELS.map((label) => ({
    label,
    score: overrides[label] ?? defaultScore,
  }));
}

export interface FakeClassifierConfig {
  /**
   * Map from input text to the tone vector that should be returned for that
   * input. Texts not present in the map fall back to a neutral-heavy vector.
   */
  vectorsByText?: Record<string, ToneScore[]>;
  /**
   * Map from input text to the token count to report for that input. Texts
   * not present default to `text.length`.
   */
  tokenLengths?: Record<string, number>;
  /**
   * Default tone vector for inputs not found in `vectorsByText`.
   */
  defaultVector?: ToneScore[];
}

export interface FakeClassifier extends Classifier {
  classifyOneCalls: string[];
  classifyManyCalls: string[][];
  tokenLengthCalls: string[];
}

/**
 * Construct a deterministic in-memory `Classifier` for unit tests. Records
 * every call so tests can assert on call counts and arguments.
 */
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
