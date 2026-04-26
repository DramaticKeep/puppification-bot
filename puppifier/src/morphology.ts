import type { Random } from './random.js';

/**
 * Probabilities and bounds for each morphology op. Stored on the Profile
 * so personalities can later tune verbosity / energy without touching the
 * generator.
 */
export interface MorphologyProbs {
  /** Base chance to stretch a vowel; scaled by intensity. */
  stretchVowelBase: number;
  /** Multiplier on top of `stretchVowelBase` at intensity = 1. */
  stretchVowelIntensityScale: number;
  /** Min and max number of additional vowel chars when stretching. */
  vowelStretchMin: number;
  vowelStretchMax: number;

  /** Base chance to double the leading consonant cluster (e.g. ruff -> rrruff). */
  doubleLeadBase: number;
  doubleLeadIntensityScale: number;
  /** Min/max extra leading consonants when doubling. */
  leadDoubleMin: number;
  leadDoubleMax: number;

  /** Probability the token is repeated (e.g. "bark bark"). High intensity only. */
  repeatBase: number;
  repeatIntensityScale: number;
  repeatMin: number;
  repeatMax: number;

  /** Probability of full uppercase. Rare; high intensity only. */
  uppercaseBase: number;
  uppercaseIntensityScale: number;

  /** Probability of capitalizing only the first letter (less aggressive than full caps). */
  capitalizeFirstBase: number;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * Stretch a vowel inside `base` by inserting `count` extra copies of the
 * picked vowel. If `base` contains no vowels, returns it unchanged.
 *
 * The vowel chosen is the longest run of consecutive vowels; we extend
 * the run rather than picking arbitrarily so 'ruff' stretches to
 * 'ruuuff', not 'rufff'.
 */
export function stretchVowel(base: string, count: number, rng: Random): string {
  if (count <= 0 || base.length === 0) return base;

  const runs: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < base.length) {
    if (VOWELS.has(base[i]!.toLowerCase())) {
      const start = i;
      while (i < base.length && VOWELS.has(base[i]!.toLowerCase())) i++;
      runs.push({ start, end: i });
    } else {
      i++;
    }
  }
  if (runs.length === 0) return base;

  const run = rng.pick(runs);
  const vowelChar = base[run.end - 1]!;
  return (
    base.slice(0, run.end) +
    vowelChar.repeat(count) +
    base.slice(run.end)
  );
}

/**
 * Double the leading consonant cluster by `count` extra copies. If the
 * base starts with a vowel, returns it unchanged.
 */
export function doubleLead(base: string, count: number): string {
  if (count <= 0 || base.length === 0) return base;
  const first = base[0]!.toLowerCase();
  if (VOWELS.has(first)) return base;
  return base[0]!.repeat(count) + base;
}

/** Repeat the token `count` extra times, joined by single spaces. */
export function repeatToken(base: string, count: number): string {
  if (count <= 0) return base;
  const parts: string[] = [base];
  for (let i = 0; i < count; i++) parts.push(base);
  return parts.join(' ');
}

/** Uppercase the entire token (preserves spaces from `repeatToken`). */
export function uppercase(base: string): string {
  return base.toUpperCase();
}

/** Capitalize only the first letter. */
export function capitalizeFirst(base: string): string {
  if (base.length === 0) return base;
  return base[0]!.toUpperCase() + base.slice(1);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Compose all morphology ops on `base`. Each op fires probabilistically
 * with `intensity in [0, 1]` modulating most knobs. Order:
 *
 * 1. decide repeat count (e.g. `bark` -> emit 2 instances)
 * 2. for **each** instance, independently roll consonant doubling
 *    (`bark` -> `bbark`) and vowel stretching (`bbark` -> `bbaaark`),
 *    so repeats look like `bbaaark baark` rather than `bbaaark bbaaark`
 * 3. join instances with single spaces
 * 4. casing: full uppercase OR first-letter capitalization (mutually
 *    exclusive). Casing applies to the whole join so a shouted
 *    repetition looks like `BBAAARK BAARK`, not `BBAAARK baark`.
 */
export function morph(
  base: string,
  intensity: number,
  rng: Random,
  probs: MorphologyProbs,
): string {
  const i = clamp(intensity, 0, 1);

  const pDouble = clamp(probs.doubleLeadBase + probs.doubleLeadIntensityScale * i, 0, 1);
  const pStretch = clamp(probs.stretchVowelBase + probs.stretchVowelIntensityScale * i, 0, 1);
  const pRepeat = clamp(probs.repeatBase + probs.repeatIntensityScale * i, 0, 1);

  // Decide the repeat count up front; each instance is then jittered
  // independently so duplicates aren't carbon copies of one another.
  const repeatCount = rng.bool(pRepeat)
    ? rng.int(probs.repeatMin, probs.repeatMax)
    : 0;
  const totalInstances = 1 + Math.max(0, repeatCount);

  const instances: string[] = [];
  for (let n = 0; n < totalInstances; n++) {
    let inst = base;
    if (rng.bool(pDouble)) {
      inst = doubleLead(inst, rng.int(probs.leadDoubleMin, probs.leadDoubleMax));
    }
    if (rng.bool(pStretch)) {
      inst = stretchVowel(
        inst,
        rng.int(probs.vowelStretchMin, probs.vowelStretchMax),
        rng,
      );
    }
    instances.push(inst);
  }

  let out = instances.join(' ');

  const pUpper = clamp(probs.uppercaseBase + probs.uppercaseIntensityScale * i, 0, 1);
  if (rng.bool(pUpper)) {
    out = uppercase(out);
  } else if (rng.bool(probs.capitalizeFirstBase)) {
    out = capitalizeFirst(out);
  }

  return out;
}
