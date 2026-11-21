import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createRateLimitStore } from "./rate-limit";

// Feature: resurrection, Property 13: Rate limit store is bounded and keys are isolated
// **Validates: Requirements 8.8, 8.9**

const config = { limit: 3, windowMs: 600_000 };

describe("Feature: resurrection, Property 13: Rate limit store is bounded and keys are isolated", () => {
  it("never holds more than maxKeys keys", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.array(fc.tuple(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 0, max: 1_000 })), {
          maxLength: 150,
        }),
        (maxKeys, calls) => {
          const store = createRateLimitStore(config, maxKeys);
          let now = 0;
          for (const [key, step] of calls) {
            now += step;
            store.check(`k${key}`, now);
            expect(store.size()).toBeLessThanOrEqual(maxKeys);
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it("decisions for a key do not depend on other keys", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom("a", "b", "c"), fc.integer({ min: 0, max: 100_000 })), {
          maxLength: 60,
        }),
        (calls) => {
          const shared = createRateLimitStore(config, 1_000);
          const solo = createRateLimitStore(config, 1_000);
          let now = 0;
          for (const [key, step] of calls) {
            now += step;
            const result = shared.check(key, now);
            if (key === "a") expect(solo.check("a", now)).toEqual(result);
          }
        },
      ),
      { numRuns: 150 },
    );
  });
});
