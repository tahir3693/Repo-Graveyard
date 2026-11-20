import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MOON_MIN, moonBrightness } from "./moon";

describe("moonBrightness", () => {
  it("is full when every repo is alive", () => {
    expect(moonBrightness(10, 10)).toBe(1);
  });

  it("is the minimum when none are alive", () => {
    expect(moonBrightness(0, 10)).toBe(MOON_MIN);
  });

  it("is halfway for half alive", () => {
    expect(moonBrightness(5, 10)).toBeCloseTo(0.625, 10);
  });

  it("returns the minimum for an empty or invalid graveyard", () => {
    expect(moonBrightness(0, 0)).toBe(MOON_MIN);
    expect(moonBrightness(3, 0)).toBe(MOON_MIN);
    expect(moonBrightness(Number.NaN, 5)).toBe(MOON_MIN);
    expect(moonBrightness(2, Number.POSITIVE_INFINITY)).toBe(MOON_MIN);
  });

  it("clamps a count larger than the total", () => {
    expect(moonBrightness(20, 10)).toBe(1);
    expect(moonBrightness(-5, 10)).toBe(MOON_MIN);
  });

  // Feature: graveyard-scene, Property 1: brightness stays in range and never drops as alive grows
  it("stays within MOON_MIN..1 and is monotonic in alive", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (a, b, total) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const x = moonBrightness(lo, total);
          const y = moonBrightness(hi, total);
          expect(x).toBeGreaterThanOrEqual(MOON_MIN);
          expect(y).toBeLessThanOrEqual(1);
          expect(y).toBeGreaterThanOrEqual(x);
        },
      ),
      { numRuns: 200 },
    );
  });
});