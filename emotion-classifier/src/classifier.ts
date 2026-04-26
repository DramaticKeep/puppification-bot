import {
  pipeline,
  type TextClassificationPipeline,
} from '@huggingface/transformers';

export interface ToneScore {
  label: string;
  score: number;
}

export interface Classifier {
  /**
   * Classify a single text into the full 28-label probability vector.
   */
  classifyOne(text: string): Promise<ToneScore[]>;
  /**
   * Classify a batch of texts. Returns one 28-label probability vector per input.
   */
  classifyMany(texts: string[]): Promise<ToneScore[][]>;
  /**
   * Number of tokens the model's tokenizer would emit for `text`
   * (including special tokens). Used to decide whether the input fits
   * within the model's context window.
   */
  tokenLength(text: string): Promise<number>;
}

const DEFAULT_MODEL_ID = 'SamLowe/roberta-base-go_emotions-onnx';

/**
 * Maximum number of tokens the underlying RoBERTa model supports per input.
 * Inputs longer than this should be split and aggregated rather than fed in
 * directly.
 */
export const MAX_MODEL_TOKENS = 512;

let pipelinePromise: Promise<TextClassificationPipeline> | null = null;

async function getPipeline(): Promise<TextClassificationPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = pipeline('text-classification', DEFAULT_MODEL_ID, {
      dtype: 'q8',
    }) as Promise<TextClassificationPipeline>;
  }
  return pipelinePromise;
}

/**
 * Default Hugging Face Transformers-backed classifier. Lazily downloads and
 * loads the ONNX-quantized GoEmotions RoBERTa model on first use; subsequent
 * calls reuse the same in-memory pipeline.
 */
export const defaultClassifier: Classifier = {
  async classifyOne(text) {
    const pipe = await getPipeline();
    const result = await pipe(text, { top_k: null });
    return result as ToneScore[];
  },
  async classifyMany(texts) {
    if (texts.length === 0) return [];
    const pipe = await getPipeline();
    const result = await pipe(texts, { top_k: null });
    return result as unknown as ToneScore[][];
  },
  async tokenLength(text) {
    const pipe = await getPipeline();
    return pipe.tokenizer.encode(text).length;
  },
};
