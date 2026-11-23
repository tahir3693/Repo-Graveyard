import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluateWindow } from "./rate-limit";

// Feature: resurrection, Property 11: Sliding window never exceeds the limit
// **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

describe("Feature: resurrection, Property 11: Sliding window never exceeds the limit", () => {
  it("never allows more than limit requests in any window and denies without recording", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1_000, max: 3_600_000 }),
        fc.array(fc.integer({ min: 0, max: 5_000_000 }), { maxLength: 200 }),
        (limit, windowMs, deltas) => {
          const config = { limit, windowMs };
          let stored: number[] = [];
          let now = 0;
          const allowedTimes: number[] = [];
          for (const delta of deltas) {
            now += delta % 700_000;
            const result = evaluateWindow(stored, now, config);
            if (result.allowed) {
              allowedTimes.push(now);
              expect(result.timestamps.length).toBe(
                result.timestamps.filter((t) => now - t < windowMs).length,
              );
            } else {
              expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
              // A denial records nothing. An earlier request in the same millisecond may
              // legitimately already be stored, so compare counts instead of absence.
              expect(result.timestamps.filter((t) => t === now)).toHaveLength(
                stored.filter((t) => t === now).length,
              );
              expect(result.timestamps.length).toBe(stored.filter((t) => now - t < windowMs).length);
            }
            expect("retryAfterSeconds" in result).toBe(!result.allowed);
            stored = result.timestamps;
          }
          for (const start of allowedTimes) {
            const inside = allowedTimes.filter((t) => t >= start && t - start < windowMs);
            expect(inside.length).toBeLessThanOrEqual(limit);
          }
        },
      ),
      { numRuns: 150 },
    );
  });
});
