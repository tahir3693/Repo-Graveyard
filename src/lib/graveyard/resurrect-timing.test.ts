import { describe, expect, it } from "vitest";
import {
  planItemDelayMs,
  RESURRECT_TIMING,
  REVEAL_BUDGET_MS,
  revealDurationMs,
} from "./resurrect-timing";

describe("revealDurationMs", () => {
  it("ends when the last plan section has finished fading in", () => {
    // 900 (delay) + 8 * 60 (stagger of the ninth item) + 400 (fade)
    expect(revealDurationMs(false)).toBe(1780);
  });

  it("stays under the 2 second budget", () => {
    expect(revealDurationMs(false)).toBeLessThan(REVEAL_BUDGET_MS);
  });

  it("uses a single short fade for reduced motion", () => {
    expect(revealDurationMs(true)).toBe(RESURRECT_TIMING.reducedMs);
    expect(revealDurationMs(true)).toBeLessThanOrEqual(150);
  });

  it("starts the glow before the fog has finished parting", () => {
    expect(RESURRECT_TIMING.glowDelayMs).toBeLessThan(RESURRECT_TIMING.fogPartMs);
  });

  it("shows the plan only after most of the fog has cleared", () => {
    expect(RESURRECT_TIMING.planDelayMs).toBeGreaterThanOrEqual(
      RESURRECT_TIMING.fogPartMs * 0.75,
    );
  });
});

describe("planItemDelayMs", () => {
  it("starts each plan section 60ms after the one before it", () => {
    expect(RESURRECT_TIMING.staggerMs).toBe(60);
    expect(planItemDelayMs(0)).toBe(RESURRECT_TIMING.planDelayMs);
    for (let i = 1; i < RESURRECT_TIMING.planItems; i += 1) {
      expect(planItemDelayMs(i) - planItemDelayMs(i - 1)).toBe(60);
    }
  });
});
