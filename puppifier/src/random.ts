/**
 * Tiny seedable PRNG used everywhere in the library so the entire pipeline
 * is deterministic given a seed.
 *
 * The implementation is mulberry32: a 4-line public-domain PRNG with a
 * 32-bit state. Plenty of distribution quality for picking sounds and
 * actions.
 */

export interface Random {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [minIncl, maxIncl]. */
  int(minIncl: number, maxIncl: number): number;
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /**
   * Weighted pick. Items with weight 0 are skipped. If every weight is 0
   * (or the arrays are empty), falls back to a uniform pick.
   *
   * Throws if `items` is empty or `items.length !== weights.length`.
   */
  pickWeighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** Bernoulli draw: true with probability `p`, clamped to [0, 1]. */
  bool(p: number): boolean;
  /** Fisher-Yates shuffle. Returns a fresh array; input is not mutated. */
  shuffle<T>(items: readonly T[]): T[];
}

/**
 * Hash an arbitrary string into a uint32 seed using FNV-1a. Stable across
 * runs and platforms so string seeds behave deterministically.
 */
function fnv1aUint32(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function resolveSeed(seed: number | string | undefined): number {
  if (seed === undefined) {
    return (Math.random() * 0x100000000) >>> 0;
  }
  if (typeof seed === 'number') {
    return seed >>> 0;
  }
  return fnv1aUint32(seed);
}

/**
 * Create a `Random` from an optional seed.
 *
 * - Numeric seeds are coerced to uint32.
 * - String seeds are hashed via FNV-1a to uint32.
 * - When `seed` is omitted, a fresh uint32 seed is drawn from `Math.random()`.
 *
 * The resolved numeric seed is returned alongside `random` so callers can
 * surface it on results (e.g. `PuppifyResult.seed`) for reproducibility.
 */
export function createRandom(seed?: number | string): {
  random: Random;
  seed: number;
} {
  const numericSeed = resolveSeed(seed);
  let state = numericSeed;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };

  const random: Random = {
    next,
    int(minIncl, maxIncl) {
      if (!Number.isFinite(minIncl) || !Number.isFinite(maxIncl)) {
        throw new Error('int() bounds must be finite numbers');
      }
      const lo = Math.ceil(Math.min(minIncl, maxIncl));
      const hi = Math.floor(Math.max(minIncl, maxIncl));
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    pick(items) {
      if (items.length === 0) {
        throw new Error('pick() called on empty array');
      }
      const idx = Math.floor(next() * items.length);
      return items[idx]!;
    },
    pickWeighted(items, weights) {
      if (items.length === 0) {
        throw new Error('pickWeighted() called on empty array');
      }
      if (items.length !== weights.length) {
        throw new Error(
          `pickWeighted() arity mismatch: ${items.length} items vs ${weights.length} weights`,
        );
      }
      let total = 0;
      for (const w of weights) {
        if (w > 0 && Number.isFinite(w)) total += w;
      }
      if (total === 0) {
        return random.pick(items);
      }
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        const w = weights[i]!;
        if (!(w > 0 && Number.isFinite(w))) continue;
        r -= w;
        if (r <= 0) return items[i]!;
      }
      // Floating-point fallback; the last positive-weight item wins.
      for (let i = items.length - 1; i >= 0; i--) {
        const w = weights[i]!;
        if (w > 0 && Number.isFinite(w)) return items[i]!;
      }
      return random.pick(items);
    },
    bool(p) {
      if (p <= 0) return false;
      if (p >= 1) return true;
      return next() < p;
    },
    shuffle(items) {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i]!;
        out[i] = out[j]!;
        out[j] = tmp;
      }
      return out;
    },
  };

  return { random, seed: numericSeed };
}
