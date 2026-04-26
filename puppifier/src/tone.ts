import type { ToneScore } from 'emotion-classifier';

/**
 * Coarse "palette key" we collapse the 28 GoEmotions labels onto. Roughly
 * an arousal x valence grid plus a curiosity bucket and neutral.
 */
export type PaletteKey =
  | 'highPositive'
  | 'lowPositive'
  | 'highNegative'
  | 'fear'
  | 'lowNegative'
  | 'curious'
  | 'neutral';

export const PALETTE_KEYS: readonly PaletteKey[] = [
  'highPositive',
  'lowPositive',
  'highNegative',
  'fear',
  'lowNegative',
  'curious',
  'neutral',
] as const;

/**
 * Mapping every GoEmotions label to a palette key. The keys here are the
 * 28 labels listed at https://github.com/google-research/google-research/tree/master/goemotions
 */
export const LABEL_TO_PALETTE: Readonly<Record<string, PaletteKey>> = {
  // High-arousal positive
  joy: 'highPositive',
  excitement: 'highPositive',
  amusement: 'highPositive',
  pride: 'highPositive',
  optimism: 'highPositive',

  // Low-arousal positive
  love: 'lowPositive',
  gratitude: 'lowPositive',
  caring: 'lowPositive',
  admiration: 'lowPositive',
  approval: 'lowPositive',
  relief: 'lowPositive',
  desire: 'lowPositive',

  // High-arousal negative
  anger: 'highNegative',
  annoyance: 'highNegative',
  disgust: 'highNegative',
  disapproval: 'highNegative',

  // Fear family
  fear: 'fear',
  nervousness: 'fear',
  embarrassment: 'fear',

  // Low-arousal negative
  sadness: 'lowNegative',
  grief: 'lowNegative',
  disappointment: 'lowNegative',
  remorse: 'lowNegative',

  // Curious / surprised
  curiosity: 'curious',
  realization: 'curious',
  confusion: 'curious',
  surprise: 'curious',

  // Neutral
  neutral: 'neutral',
};

export interface PaletteMix {
  /**
   * Per-palette weights normalized to sum to 1 (or 0 across the board if
   * input was empty / all-zero, in which case `neutral` is set to 1 as a
   * safe fallback).
   */
  weights: Record<PaletteKey, number>;
  /**
   * Peak top-K score, used to drive density and morphology intensity.
   * `0` for empty / all-zero input.
   */
  intensity: number;
}

function emptyWeights(): Record<PaletteKey, number> {
  return {
    highPositive: 0,
    lowPositive: 0,
    highNegative: 0,
    fear: 0,
    lowNegative: 0,
    curious: 0,
    neutral: 0,
  };
}

/**
 * Collapse a tone vector into a palette mix and intensity. Unknown labels
 * fall through to `neutral` so a future model with extra labels degrades
 * gracefully.
 */
export function blendTones(tones: readonly ToneScore[]): PaletteMix {
  const weights = emptyWeights();
  let total = 0;
  let peak = 0;

  for (const t of tones) {
    if (!Number.isFinite(t.score) || t.score <= 0) continue;
    const key = LABEL_TO_PALETTE[t.label] ?? 'neutral';
    weights[key] += t.score;
    total += t.score;
    if (t.score > peak) peak = t.score;
  }

  if (total === 0) {
    return { weights: { ...emptyWeights(), neutral: 1 }, intensity: 0 };
  }

  for (const key of PALETTE_KEYS) {
    weights[key] = weights[key] / total;
  }

  return { weights, intensity: peak };
}
