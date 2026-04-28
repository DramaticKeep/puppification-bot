/**
 * Common abbreviations whose trailing period should NOT be treated as a
 * sentence terminator. Lowercase, no trailing dot.
 */
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'sr',
  'jr',
  'prof',
  'st',
  'vs',
  'etc',
  'inc',
  'ltd',
  'co',
  'no',
  'fig',
  'al',
]);

/**
 * Matches a run of terminators (`.`, `!`, `?`) optionally followed by closing
 * quotes/brackets and then mandatory whitespace. Capture groups:
 *   1. terminator run
 *   2. closing quotes/brackets
 *   3. trailing whitespace
 *
 * The required whitespace is what makes decimals (e.g. `3.14`) and trailing
 * end-of-string punctuation (e.g. final `.`) safe by construction: they don't
 * have whitespace after the period, so they never match.
 */
const SPLIT_CANDIDATE = /([.!?]+)(["'\u201D\u2019)\]]*)(\s+)/g;

/**
 * Characters that can validly start a new sentence (letter, digit,
 * or an opening quote/bracket).
 */
const SENTENCE_STARTER = /[A-Z0-9"'\u201C\u2018(\[]/;
const LOWER_CASE_CHARS = /[a-z]/;

/**
 * Split a phrase into sentences using a dependency-free heuristic.
 *
 * Behavior:
 * - Empty / whitespace-only input returns `[]`.
 * - Splits on `.`, `!`, `?` (and runs thereof) followed by whitespace and
 *   then a sentence-starting character.
 * - Preserves common abbreviations (`Mr.`, `Dr.`, `etc.`...) and
 *   multi-letter abbreviations containing internal periods (`e.g.`,
 *   `i.e.`, `U.S.`).
 * - Preserves decimals like `3.14` (the period has no following whitespace).
 * - Treats trailing closing quotes/brackets as part of the preceding
 *   sentence (e.g. `She said "hi!" and left.` is one sentence).
 */
export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences: string[] = [];
  let start = 0;

  SPLIT_CANDIDATE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SPLIT_CANDIDATE.exec(trimmed)) !== null) {
    const terminators = match[1] ?? '';
    const closers = match[2] ?? '';
    const ws = match[3] ?? '';
    const termStart = match.index;
    const sentenceEnd = termStart + terminators.length + closers.length;
    const nextStart = sentenceEnd + ws.length;

    const nextChar = trimmed.charAt(nextStart);
    if (!nextChar) break;
    if ( 
      !SENTENCE_STARTER.test(nextChar) && 
      (closers.includes('"') && LOWER_CASE_CHARS.test(nextChar))
    ) continue;

    // Abbreviation guard: only relevant when the terminator is a single
    // period (runs like `...`, `!?`, `!!` are real sentence ends).
    if (terminators === '.') {
      const before = trimmed.substring(start, termStart);
      const wordMatch = /([\w.]+)$/.exec(before);
      if (wordMatch) {
        const cleaned = (wordMatch[1] ?? '').toLowerCase().replace(/\.+$/, '');
        // Multi-letter abbreviations with internal dots (e.g, i.e, U.S, etc.)
        if (cleaned.includes('.')) continue;
        if (ABBREVIATIONS.has(cleaned)) continue;
      }
    }

    sentences.push(trimmed.substring(start, sentenceEnd).trim());
    start = nextStart;
  }

  if (start < trimmed.length) {
    const tail = trimmed.substring(start).trim();
    if (tail) sentences.push(tail);
  }

  return sentences;
}
