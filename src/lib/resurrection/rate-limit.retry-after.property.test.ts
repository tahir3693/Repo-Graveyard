import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluateWindow } from "./rate-limit";

// Feature: resurrection, Property 12: Retry-after is honest and clock skew is tolerated
// **Validates: Requirements 8.3, 8.5**

describe("Feature: resurrection, Property 12: Retry-after is honest and clock skew is tolerated", () => {
  it("allows the same call after retryAfterSeconds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1_000, max: 3_600_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(fc.integer({ min: 0, max: 3_600_000 }), { minLength: 1, maxLength: 60 }),
        (limit, windowMs, now, offsets) => {
          const config = { limit, windowMs };
          // Reachable states only: evaluateWindow never stores more than `limit` entries.
          const stored = offsets.slice(0, limit).map((o) => now - (o % windowMs));
          const result = evaluateWindow(stored, now, config);
          if (result.allowed) return;
          const later = now + result.retryAfterSeconds * 1000;
          expect(evaluateWindow(result.timestamps, later, config).allowed).toBe(true);
        },
      ),
      { numRuns: 150 },
    );
  });

  it("tolerates future, NaN and infinite timestamps", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.integer({ min: 0, max: 2_000_000 }),
            fc.constantFrom(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY),
          ),
          { maxLength: 40 },
        ),
        fc.integer({ min: 0, max: 1_000_000 }),
        (stored, now) => {
          const config = { limit: 5, windowMs: 600_000 };
          const result = evaluateWindow(stored, now, config);
          expect(result.timestamps.every((t) => Number.isFinite(t) && t <= now)).toBe(true);
        },
      ),
      { numRuns: 150 },
    );
  });
});
