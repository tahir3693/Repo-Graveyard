/**
 * Resurrection reveal timeline, in milliseconds, measured from the moment the
 * revival plan arrives. The whole sequence must stay under REVEAL_BUDGET_MS.
 */
export const RESURRECT_TIMING = {
  /** Fog panels slide apart and fade out. */
  fogPartMs: 700,
  /** The stone starts to glow while the fog is still parting. */
  glowDelayMs: 300,
  glowMs: 600,
  /** The first plan section appears once the fog has mostly cleared. */
  planDelayMs: 900,
  /** Each later plan section starts this long after the one before it. */
  staggerMs: 60,
  /** Fade and rise of one plan section. */
  sectionMs: 400,
  /** The plan title plus eight sections: verdict, diagnosis, roadmap, quick wins, risks, effort, issue, source. */
  planItems: 9,
  /** Fade used for every step when reduced motion is on (design-system.md: 150ms or less). */
  reducedMs: 150,
} as const;

/** Success must finish in under 2 seconds. */
export const REVEAL_BUDGET_MS = 2000;

/** When plan item `index` (0 is the title) starts, from the moment the plan arrives. */
export function planItemDelayMs(index: number): number {
  return RESURRECT_TIMING.planDelayMs + index * RESURRECT_TIMING.staggerMs;
}

/** Time from the plan arriving until the last step ends. */
export function revealDurationMs(reduceMotion: boolean): number {
  if (reduceMotion) return RESURRECT_TIMING.reducedMs;
  const t = RESURRECT_TIMING;
  const lastItem = planItemDelayMs(t.planItems - 1) + t.sectionMs;
  return Math.max(t.fogPartMs, t.glowDelayMs + t.glowMs, lastItem);
}
