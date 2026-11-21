import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CAUSE_CODES, containsBannedWord } from "@/lib/epitaphs";
import type { Status } from "@/lib/scoring";
import { buildFallbackPlan } from "./fallback";
import { RevivalPlanSchema, sanitizePlanText } from "./plan";

const nameArb = fc.oneof(
  fc.string({ maxLength: 200 }),
  fc.string({ unit: "grapheme", maxLength: 200 }),
  fc.array(fc.constantFrom("@", "`", "<b>", "![x](y)", "quit", "you", " ", "\n", "a", "#"), { maxLength: 60 }).map((p) => p.join("")),
);
const causeArb = fc.constantFrom(...CAUSE_CODES);
const statusArb = fc.constantFrom<Status>("alive", "dying", "dead", "ancient");

describe("Feature: resurrection, Property 9: Fallback plan is valid, stable, deterministic and in tone", () => {
  /** **Validates: Requirements 7.5, 7.6, 7.7, 7.8** */
  it("holds for any name, cause and status", () => {
    fc.assert(
      fc.property(nameArb, causeArb, statusArb, (name, causeCode, status) => {
        const plan = buildFallbackPlan({ name, causeCode, status });
        expect(RevivalPlanSchema.safeParse(plan).success).toBe(true);
        for (const text of [plan.diagnosis, plan.smallestNextStep, plan.issueTitle, plan.issueBody]) {
          expect(sanitizePlanText(text)).toBe(text);
          expect(containsBannedWord(text)).toBe(false);
        }
        expect(buildFallbackPlan({ name, causeCode, status })).toEqual(plan);
      }),
      { numRuns: 200 },
    );
  });

  it("gives distinct plans per cause for a fixed name", () => {
    fc.assert(
      fc.property(nameArb, statusArb, (name, status) => {
        const plans = CAUSE_CODES.map((causeCode) => JSON.stringify(buildFallbackPlan({ name, causeCode, status })));
        expect(new Set(plans).size).toBe(CAUSE_CODES.length);
      }),
      { numRuns: 100 },
    );
  });
});
