import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EFFORTS, parsePlan } from "./plan";

// Feature: resurrection, Property 7: Extra fields are discarded
// **Validates: Requirements 6.3**

const word = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,30}$/);
const validPlan = fc.record({
  diagnosis: word,
  smallestNextStep: word,
  effort: fc.constantFrom(...EFFORTS),
  issueTitle: word,
  issueBody: word,
});
const KEYS = ["diagnosis", "effort", "issueBody", "issueTitle", "smallestNextStep"];

describe("Feature: resurrection, Property 7: Extra fields are discarded", () => {
  it("returns exactly the five plan keys", () => {
    fc.assert(
      fc.property(
        validPlan,
        fc.dictionary(
          fc.string({ maxLength: 12 }).filter((k) => !KEYS.includes(k)),
          fc.jsonValue(),
          { maxKeys: 8 },
        ),
        (plan, extras) => {
          const text = JSON.stringify({ ...extras, ...plan });
          const result = parsePlan(text);
          expect(result.ok).toBe(true);
          if (result.ok) expect(Object.keys(result.plan).sort()).toEqual(KEYS);
        },
      ),
      { numRuns: 150 },
    );
  });
});
