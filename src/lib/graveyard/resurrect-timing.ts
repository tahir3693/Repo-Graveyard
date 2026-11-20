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
  /** The plan fades in once the fog has mostly cleared. */
  planDelayMs: 900,
  planMs: 500,
  /** Fade used for every step when reduced motion is on (design-system.md: 150ms or less). */
  reducedMs: 150,
} as const;

/** Success must finish in under 2 seconds. */
export const REVEAL_BUDGET_MS = 2000;

/** Time from the plan arriving until the last step ends. */
export function revealDurationMs(reduceMotion: boolean): number {
  if (reduceMotion) return RESURRECT_TIMING.reducedMs;
  const t = RESURRECT_TIMING;
  return Math.max(t.fogPartMs, t.glowDelayMs + t.glowMs, t.planDelayMs + t.planMs);
}
