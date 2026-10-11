/** Summaries of measured display frame intervals, for the development performance overlay. */

const percentile = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);

/** A summary of display frame intervals (ms): measured. */
export function summarizeFrames(intervals: number[]) {
  const sorted = [...intervals].sort((a, b) => a - b);
  const total = intervals.reduce((a, b) => a + b, 0);
  return {
    fps: total > 0 ? (intervals.length * 1000) / total : 0,
    avgMs: intervals.length ? total / intervals.length : 0,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    spikes: intervals.filter((ms) => ms > 50).length,
    worstMs: sorted.length ? sorted[sorted.length - 1] : 0,
  };
}

/** Not representative: the tab is hidden, or the browser is throttling it (frames a quarter of a second apart and more). */
export function throttled(hidden: boolean, p50Ms: number): boolean {
  return hidden || p50Ms > 250;
}
