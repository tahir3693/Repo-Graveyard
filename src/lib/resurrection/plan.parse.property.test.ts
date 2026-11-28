import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RESURRECTION_LIMITS } from "./limits";
import { parsePlan, RevivalPlanSchema } from "./plan";
import { makePlan } from "./plan.fixtures";

// Feature: resurrection, Property 5: parsePlan never throws and accepts only valid plans
// **Validates: Requirements 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 6.13**

const KEYS = ["diagnosis", "effort", "issue", "quickWins", "risks", "roadmap", "verdict"];
const word = fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,30}$/);
const validPlan = word.map((w) => makePlan({ diagnosis: w }));

describe("Feature: resurrection, Property 5: parsePlan never throws and accepts only valid plans", () => {
  it("never throws and returns only schema-valid plans with the seven keys", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string({ maxLength: 300 }), fc.json(), fc.anything(), validPlan.map((p) => JSON.stringify(p))),
        (input) => {
          const result = parsePlan(input);
          if (result.ok) {
            expect(RevivalPlanSchema.safeParse(result.plan).success).toBe(true);
            expect(Object.keys(result.plan).sort()).toEqual(KEYS);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("rejects over-long input, prose around an object and arrays", () => {
    fc.assert(
      fc.property(validPlan, fc.constantFrom("Hello ", "```x ", "Sure! "), (p, prose) => {
        const json = JSON.stringify(p);
        expect(parsePlan(prose + json)).toEqual({ ok: false });
        expect(parsePlan(json + " thanks")).toEqual({ ok: false });
        expect(parsePlan(JSON.stringify([p]))).toEqual({ ok: false });
        expect(parsePlan(json + " ".repeat(RESURRECTION_LIMITS.LLM_RAW_MAX_CHARS))).toEqual({ ok: false });
      }),
      { numRuns: 100 },
    );
  });

  it("rejects a plan with any single top-level section removed", () => {
    fc.assert(
      fc.property(validPlan, fc.constantFrom(...KEYS), (p, key) => {
        const copy: Record<string, unknown> = { ...p };
        delete copy[key];
        expect(parsePlan(JSON.stringify(copy))).toEqual({ ok: false });
      }),
      { numRuns: 100 },
    );
  });

  it("never lets a link or HTML tag through in any field", () => {
    const hostile = fc.constantFrom(
      "<script>x</script>",
      "<a href='http://e.com'>x</a>",
      "[x](http://e.com)",
      "![x](http://e.com/a.png)",
      "http://e.com",
      "https://e.com/path?q=1",
      "www.e.com",
      "javascript:alert(1)",
    );
    fc.assert(
      fc.property(word, hostile, (w, bad) => {
        const result = parsePlan(JSON.stringify(makePlan({ diagnosis: `${w} ${bad} ${w}` })));
        if (result.ok) {
          expect(result.plan.diagnosis).not.toMatch(/<[A-Za-z/]|:\/\/|www\.|javascript:|\]\(/i);
        }
      }),
      { numRuns: 100 },
    );
  });
});
