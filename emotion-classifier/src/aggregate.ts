import type { ToneScore } from './classifier.js';

/**
 * Compute the length-weighted average of multiple per-sentence tone vectors.
 *
 * Each input vector should contain the same set of labels (the 28 GoEmotions
 * categories). The output preserves the label order of the first input vector
 * and is NOT sorted; callers that want top-K should sort and slice afterwards.
 *
 * If `weights` is omitted, equal weights are used. Weights of zero or
 * negative values are treated as zero. If all weights are zero (or if the
 * input is empty) the function returns an empty array.
 */
export function weightedAverage(
  perInput: ToneScore[][],
  weights?: number[],
): ToneScore[] {
  if (perInput.length === 0) return [];

  const effectiveWeights =
    weights ?? new Array<number>(perInput.length).fill(1);

  if (effectiveWeights.length !== perInput.length) {
    throw new Error(
      `weightedAverage: weights length (${effectiveWeights.length}) does not match inputs length (${perInput.length})`,
    );
  }

  const totals = new Map<string, number>();
  let totalWeight = 0;

  // Preserve the label order from the first vector so the output is stable
  // and predictable for callers that don't sort.
  const firstVector = perInput[0];
  if (!firstVector) return [];
  const labelOrder: string[] = firstVector.map((t) => t.label);
  for (const label of labelOrder) totals.set(label, 0);

  for (let i = 0; i < perInput.length; i++) {
    const vec = perInput[i];
    const w = effectiveWeights[i];
    if (vec === undefined || w === undefined) continue;
    const weight = Math.max(0, w);
    if (weight === 0) continue;
    totalWeight += weight;
    for (const { label, score } of vec) {
      totals.set(label, (totals.get(label) ?? 0) + score * weight);
    }
  }

  if (totalWeight === 0) return [];

  return labelOrder.map((label) => ({
    label,
    score: (totals.get(label) ?? 0) / totalWeight,
  }));
}
