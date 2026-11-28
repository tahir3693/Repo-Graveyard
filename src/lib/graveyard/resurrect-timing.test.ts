import { describe, expect, it } from "vitest";
import {
  planItemDelayMs,
  RESURRECT_TIMING,
  REVEAL_BUDGET_MS,
  revealDurationMs,
} from "./resurrect-timing";

const t = RESURRECT_TIMING;

describe("revealDurationMs", () => {
  it("ends when the glow has settled, the last step of the sequence", () => {
    // 500 (glow delay) + 900 (glow)
    expect(revealDurationMs(false)).toBe(1400);
  });

  it("stays under the 2 second budget", () => {
    expect(revealDurationMs(false)).toBeLessThan(REVEAL_BUDGET_MS);
  });

  it("jumps straight to the final state under reduced motion", () => {
    expect(revealDurationMs(true)).toBe(0);
  });
});

describe("the order of the sequence", () => {
  it("lights the candle first, then clears the fog, then swells the glow", () => {
    expect(t.candleDelayMs).toBeLessThan(t.fogDelayMs);
    expect(t.fogDelayMs).toBeLessThan(t.glowDelayMs);
  });

  it("lets the candle, the fog and the glow overlap, so it feels like one moment", () => {
    expect(t.fogDelayMs).toBeLessThan(t.candleDelayMs + t.candleMs);
    expect(t.glowDelayMs).toBeLessThan(t.fogDelayMs + t.fogPartMs);
  });

  it("every step ends inside the budget", () => {
    for (const end of [
      t.candleDelayMs + t.candleMs,
      t.fogDelayMs + t.fogPartMs,
      t.glowDelayMs + t.glowMs,
      planItemDelayMs(t.planItems - 1) + t.sectionMs,
    ]) {
      expect(end).toBeLessThan(REVEAL_BUDGET_MS);
    }
  });
});

describe("planItemDelayMs", () => {
  it("starts each plan section 60ms after the one before it", () => {
    expect(t.staggerMs).toBe(60);
    expect(planItemDelayMs(0)).toBe(t.planDelayMs);
    for (let i = 1; i < t.planItems; i += 1) {
      expect(planItemDelayMs(i) - planItemDelayMs(i - 1)).toBe(60);
    }
  });

  it("never makes the plan wait for the stone: it starts before the fog has even begun to clear fully", () => {
    expect(t.planDelayMs).toBeLessThan(t.fogDelayMs + t.fogPartMs);
    expect(t.planDelayMs).toBeLessThanOrEqual(250);
  });

  it("has the whole plan on screen before the sequence ends", () => {
    expect(planItemDelayMs(t.planItems - 1) + t.sectionMs).toBeLessThanOrEqual(revealDurationMs(false));
  });
});
