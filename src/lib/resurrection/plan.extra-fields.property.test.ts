import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parsePlan } from "./plan";
import { makePlan } from "./plan.fixtures";

// Feature: resurrection, Property 7: Extra fields are discarded
// **Validates: Requirements 6.3**

const KEYS = ["diagnosis", "effort", "issue", "quickWins", "risks", "roadmap", "verdict"];

describe("Feature: resurrection, Property 7: Extra fields are discarded", () => {
  it("returns exactly the seven plan keys", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ maxLength: 12 }).filter((k) => !KEYS.includes(k) && k !== "__proto__"),
          fc.jsonValue(),
          { maxKeys: 8 },
        ),
        (extras) => {
          const result = parsePlan(JSON.stringify({ ...extras, ...makePlan() }));
          expect(result.ok).toBe(true);
          if (result.ok) expect(Object.keys(result.plan).sort()).toEqual(KEYS);
        },
      ),
      { numRuns: 150 },
    );
  });
});
