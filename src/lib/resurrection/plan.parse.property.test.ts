import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RESURRECTION_LIMITS } from "./limits";
import { EFFORTS, RevivalPlanSchema, parsePlan } from "./plan";

// Feature: resurrection, Property 5: parsePlan never throws and accepts only valid plans
// **Validates: Requirements 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 6.13**

const validPlan = fc.record({
  diagnosis: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  smallestNextStep: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  effort: fc.constantFrom(...EFFORTS),
  issueTitle: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  issueBody: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
});

describe("Feature: resurrection, Property 5: parsePlan never throws and accepts only valid plans", () => {
  it("never throws and returns only schema-valid five-key plans", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string({ maxLength: 300 }), fc.json(), fc.anything(), validPlan.map((p) => JSON.stringify(p))),
        (input) => {
          const result = parsePlan(input);
          if (result.ok) {
            expect(RevivalPlanSchema.safeParse(result.plan).success).toBe(true);
            expect(Object.keys(result.plan).sort()).toEqual(
              ["diagnosis", "effort", "issueBody", "issueTitle", "smallestNextStep"],
            );
            expect(EFFORTS).toContain(result.plan.effort);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("rejects over-long input, prose around an object, arrays and bad effort", () => {
    fc.assert(
      fc.property(validPlan, fc.constantFrom("Hello ", "```x ", "Sure! "), (p, prose) => {
        const json = JSON.stringify(p);
        expect(parsePlan(prose + json)).toEqual({ ok: false });
        expect(parsePlan(json + " thanks")).toEqual({ ok: false });
        expect(parsePlan(JSON.stringify([p]))).toEqual({ ok: false });
        expect(parsePlan(JSON.stringify({ ...p, effort: p.effort.toUpperCase() }))).toEqual({ ok: false });
        expect(parsePlan(JSON.stringify({ ...p, effort: p.effort + " " }))).toEqual({ ok: false });
        const padded = json + " ".repeat(RESURRECTION_LIMITS.LLM_RAW_MAX_CHARS);
        expect(parsePlan(padded)).toEqual({ ok: false });
      }),
      { numRuns: 100 },
    );
  });
});
