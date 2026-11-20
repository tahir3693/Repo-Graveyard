import { describe, expect, it } from "vitest";
import {
  RESURRECT_TIMING,
  REVEAL_BUDGET_MS,
  revealDurationMs,
} from "./resurrect-timing";

describe("revealDurationMs", () => {
  it("ends when the plan has finished fading in", () => {
    expect(revealDurationMs(false)).toBe(1400);
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
