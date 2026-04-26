import {
  defaultClassifier,
  MAX_MODEL_TOKENS,
  type Classifier,
  type ToneScore,
} from './classifier.js';
import { splitSentences } from './sentences.js';
import { weightedAverage } from './aggregate.js';

export type { Classifier, ToneScore } from './classifier.js';

export interface ClassifiedItem {
  text: string;
  tone: ToneScore[];
}

export interface PhraseEmotionClassification {
  phrase: ClassifiedItem;
  sentences: ClassifiedItem[];
}

export interface Options {
  /**
   * Number of top tones to keep per item. Defaults to `3`.
   */
  topK?: number;
  /**
   * Inject a custom classifier. Mainly useful for testing; if omitted the
   * default Hugging Face Transformers-backed singleton is used.
   */
  classifier?: Classifier;
}

const DEFAULT_TOP_K = 3;

function topK(vector: ToneScore[], k: number): ToneScore[] {
  return [...vector].sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Classify the emotional tone of a phrase and each of its sentences using
 * the GoEmotions taxonomy (28 labels).
 *
 * Returns the top-K tones (default 3) for the full phrase and for each
 * sentence, sorted by score descending.
 *
 * For the phrase-level tone, the model is run on the entire input when it
 * fits within the model's token limit. When it does not, the phrase tone is
 * computed by length-weighted averaging of the per-sentence tone vectors.
 */
export async function get_phrase_emotion_classification(
  text: string,
  options: Options = {},
): Promise<PhraseEmotionClassification> {
  const k = options.topK ?? DEFAULT_TOP_K;
  if (!Number.isFinite(k) || k <= 0) {
    throw new Error(`topK must be a positive number, got: ${k}`);
  }
  const classifier = options.classifier ?? defaultClassifier;

  const trimmed = text.trim();
  const sentenceTexts = splitSentences(trimmed);

  // Per-sentence inference (batched).
  const sentenceVectors =
    sentenceTexts.length > 0
      ? await classifier.classifyMany(sentenceTexts)
      : [];

  // Phrase-level inference: prefer whole-text inference, fall back to
  // length-weighted aggregation if the input exceeds the model's context.
  let phraseVector: ToneScore[];
  if (trimmed.length === 0) {
    phraseVector = [];
  } else {
    const tokenCount = await classifier.tokenLength(trimmed);
    if (tokenCount <= MAX_MODEL_TOKENS) {
      phraseVector = await classifier.classifyOne(trimmed);
    } else {
      const weights = sentenceTexts.map((s) => s.length);
      phraseVector = weightedAverage(sentenceVectors, weights);
    }
  }

  return {
    phrase: {
      text: trimmed,
      tone: topK(phraseVector, k),
    },
    sentences: sentenceTexts.map((sentenceText, i) => ({
      text: sentenceText,
      tone: topK(sentenceVectors[i] ?? [], k),
    })),
  };
}

/**
 * camelCase alias of {@link get_phrase_emotion_classification} for callers
 * preferring idiomatic TypeScript naming.
 */
export const getPhraseEmotionClassification = get_phrase_emotion_classification;
