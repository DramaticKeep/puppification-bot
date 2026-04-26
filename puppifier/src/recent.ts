/**
 * Tiny FIFO buffer used by `grammar.ts` and `translator.ts` to penalize
 * recently-emitted items during weighted sampling. Per-call, not shared
 * across `puppify()` invocations.
 */
export class RecentBuffer<T> {
  private readonly buf: T[] = [];

  constructor(private readonly windowSize: number) {
    if (windowSize < 0 || !Number.isFinite(windowSize)) {
      throw new Error(`RecentBuffer window must be a non-negative finite number, got ${windowSize}`);
    }
  }

  has(item: T): boolean {
    return this.buf.includes(item);
  }

  push(item: T): void {
    if (this.windowSize === 0) return;
    this.buf.push(item);
    while (this.buf.length > this.windowSize) {
      this.buf.shift();
    }
  }

  /** Mostly for tests / debugging. */
  size(): number {
    return this.buf.length;
  }
}
