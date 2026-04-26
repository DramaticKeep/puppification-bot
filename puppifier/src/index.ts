import {
  get_phrase_emotion_classification,
  type Classifier,
  type PhraseEmotionClassification,
  type ToneScore,
} from 'emotion-classifier';
import { defaultProfile, type Profile } from './profile.js';
import { createRandom, type Random } from './random.js';
import { makeRecentBuffers, TranslateContext, translateSentence } from './translator.js';

export type { Classifier, PhraseEmotionClassification, ToneScore };
export type { TranslateContext } from './translator.js';
export type { Profile } from './profile.js';

export interface PuppifiedSentence {
  source: string;
  dog: string;
  tone: ToneScore[];
}

export interface PuppifyResult {
  text: string;
  source: string;
  phraseTone: ToneScore[];
  sentences: PuppifiedSentence[];
  seed: number;
}

export interface PuppifyOptions {
  /** If omitted, a fresh crypto-random seed is generated each call. */
  seed?: number | string;
  /**
   * Inject a Classifier (e.g. the fake from tests). Defaults to the
   * emotion-classifier singleton. Ignored by `puppify_classification` /
   * `Puppifier#translateClassification`, which never invoke the classifier.
   */
  classifier?: Classifier;
  /**
   * Forwarded to emotion-classifier. Default 3. Ignored by
   * `puppify_classification` / `Puppifier#translateClassification`.
   */
  topK?: number;

  /**
   * Inject a pre-existing TranslateContext. Defaults to a fresh context with the default profile.
   */
  context?: TranslateContext;
}



export function create_translation_context(profile?: Profile, seed_?: number | string): TranslateContext {
  profile = profile ?? defaultProfile;
  const { random, seed } = createRandom(seed_);
  console.log('create_translation_context input: ', seed_, ' output: ', seed);
  return {
    seed,
    rng: random,
    profile: profile,
    buffers: makeRecentBuffers(defaultProfile),
  };
}

/**
 * Single shared render path. Both entry points and the Puppifier class
 * delegate here, so they cannot drift.
 */
function renderClassification(
  classification: PhraseEmotionClassification,
  context?: TranslateContext,
): PuppifyResult {
  const ctx = context ?? create_translation_context();
  const sentences: PuppifiedSentence[] = classification.sentences.map((s) => ({
    source: s.text,
    tone: s.tone,
    dog: translateSentence(s.text, s.tone, ctx),
  }));
  return {
    text: sentences.map((s) => s.dog).join(' ').trim(),
    source: classification.phrase.text,
    phraseTone: classification.phrase.tone,
    sentences,
    seed: ctx.seed,
  };
}

/**
 * Core translation entry point. Skips the classifier entirely; renders
 * dog-speech directly from a pre-computed `PhraseEmotionClassification`.
 *
 * Synchronous: no inference, no I/O. Useful when callers already have the
 * classification (cached, batched, or computed elsewhere) and want to
 * avoid re-running inference.
 *
 * `options.classifier` and `options.topK` are ignored on this path.
 */
export function puppify_classification(
  classification: PhraseEmotionClassification,
  options: PuppifyOptions = {},
): PuppifyResult {
  return renderClassification(classification, options.context);
}

/** camelCase alias of {@link puppify_classification}. */
export const puppifyClassification = puppify_classification;

/**
 * Convenience entry point: runs the emotion-classifier on `text`, then
 * delegates to `puppify_classification` to render the result.
 */
export async function puppify(
  text: string,
  options: PuppifyOptions = {},
): Promise<PuppifyResult> {
  const classification = await get_phrase_emotion_classification(text, {
    classifier: options.classifier,
    topK: options.topK,
  });
  return puppify_classification(classification, options);
}

/**
 * snake_case alias matching the emotion-classifier convention. Same
 * function signature and behavior as {@link puppify}.
 */
export const puppify_text = puppify;


/**
 * Stateful variant. Holds a single RNG stream and (optionally) an
 * injected classifier so successive `translate()` / `translateClassification()`
 * calls share the same deterministic stream after `setSeed(...)`.
 */
export class Puppifier {
  private readonly classifier: Classifier | undefined;
  private readonly topK: number | undefined;
  private readonly profile: Profile;
  private readonly context: TranslateContext;

  constructor(options: PuppifyOptions = {}) {
    this.classifier = options.classifier;
    this.topK = options.topK;
    this.profile = defaultProfile;
    this.context = options.context ?? create_translation_context(defaultProfile, options.seed);
  }

  /** Reset the RNG stream from a fresh seed. */
  setSeed(seed: number | string): void {
    const { random, seed: numericSeed } = createRandom(seed);
    this.context.rng = random;
    this.context.seed = numericSeed;
  }

  /** Runs the classifier on `text`, then renders. */
  async translate(text: string): Promise<PuppifyResult> {
    const classification = await get_phrase_emotion_classification(text, {
      classifier: this.classifier,
      topK: this.topK,
    });
    return renderClassification(
      classification,
      this.context,
    );
  }

  /**
   * Renders directly from a pre-computed classification. Synchronous;
   * the classifier is never invoked.
   */
  translateClassification(
    classification: PhraseEmotionClassification,
  ): PuppifyResult {
    return renderClassification(
      classification,
      this.context,
    );
  }
}
