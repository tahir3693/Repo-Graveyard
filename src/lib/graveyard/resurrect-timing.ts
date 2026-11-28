/**
 * Resurrection moment timeline, in milliseconds, measured from the moment the revival
 * plan arrives. The whole sequence must stay under REVEAL_BUDGET_MS, and it plays once.
 *
 *   0 ms     the badge changes to "Reviving" and the candle starts to light
 *   250 ms   the fog starts to clear
 *   500 ms   a violet glow swells once, then settles
 *   200 ms+  the plan sections appear, 60ms apart, so the plan never waits for the stone
 */
export const RESURRECT_TIMING = {
  /** The candle lights first. */
  candleDelayMs: 0,
  candleMs: 450,
  /** The fog starts to clear while the flame is still growing. */
  fogDelayMs: 250,
  fogPartMs: 800,
  /** One violet swell, then a calm glow stays. */
  glowDelayMs: 500,
  glowMs: 900,
  /** The first plan section appears early. Nothing in the plan waits for the stone. */
  planDelayMs: 200,
  /** Each later plan section starts this long after the one before it. */
  staggerMs: 60,
  /** Fade and rise of one plan section. */
  sectionMs: 400,
  /** The plan title plus eight sections: verdict, diagnosis, roadmap, quick wins, risks, effort, issue, source. */
  planItems: 9,
} as const;

/** The sequence must finish in under 2 seconds. */
export const REVEAL_BUDGET_MS = 2000;

/** When plan item `index` (0 is the title) starts, from the moment the plan arrives. */
export function planItemDelayMs(index: number): number {
  return RESURRECT_TIMING.planDelayMs + index * RESURRECT_TIMING.staggerMs;
}

/** Time from the plan arriving until the last step ends. Reduced motion jumps to the end state. */
export function revealDurationMs(reduceMotion: boolean): number {
  if (reduceMotion) return 0;
  const t = RESURRECT_TIMING;
  const lastItem = planItemDelayMs(t.planItems - 1) + t.sectionMs;
  return Math.max(
    t.candleDelayMs + t.candleMs,
    t.fogDelayMs + t.fogPartMs,
    t.glowDelayMs + t.glowMs,
    lastItem,
  );
}

/** One step of the moment. `iterations` is how many times it plays: always 1. */
export interface MomentStep {
  name: "candle" | "fog" | "glow";
  delayMs: number;
  durationMs: number;
  iterations: 1;
}
/**
 * The steps the stage plays when the plan arrives. The stage reads its transitions from
 * here, so a test of this list is a test of what runs. Under reduced motion every step has
 * no delay and no duration: the stage jumps to its end state.
 */
export function momentSteps(reduceMotion: boolean): readonly MomentStep[] {
  const t = RESURRECT_TIMING;
  const step = (name: MomentStep["name"], delayMs: number, durationMs: number): MomentStep => ({
    name,
    delayMs: reduceMotion ? 0 : delayMs,
    durationMs: reduceMotion ? 0 : durationMs,
    iterations: 1,
  });
  return [
    step("candle", t.candleDelayMs, t.candleMs),
    step("fog", t.fogDelayMs, t.fogPartMs),
    step("glow", t.glowDelayMs, t.glowMs),
  ];
}
/** After the candle lights, the flame breathes: a slow ambient loop, not part of the sequence. */
export const FLAME_BREATH_SECONDS = 2.4;
