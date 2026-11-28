import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { containsBannedWord } from "@/lib/epitaphs";
import type { Status } from "@/lib/scoring";
import { buildFallbackPlan, type FallbackFacts } from "./fallback";
import { countTaskItems, planStrings, RevivalPlanSchema, sanitizePlanText } from "./plan";

const nameArb = fc.oneof(
  fc.string({ maxLength: 200 }),
  fc.string({ unit: "grapheme", maxLength: 200 }),
  fc.array(fc.constantFrom("@", "`", "<b>", "![x](y)", "quit", "you", " ", "\n", "a", "#", "www.", "mailto", "http", "://"), { maxLength: 60 }).map((p) => p.join("")),
);

const factsArb: fc.Arbitrary<FallbackFacts> = fc.record({
  name: nameArb,
  status: fc.constantFrom<Status>("alive", "dying", "dead", "ancient"),
  daysInactive: fc.option(fc.integer({ min: 0, max: 100_000 }), { nil: null }),
  ciState: fc.constantFrom("passing", "failing", "none"),
  failingChecks: fc.integer({ min: 0, max: 5 }),
  outdatedDeps: fc.option(fc.boolean(), { nil: null }),
  openIssues: fc.integer({ min: 0, max: 100_000 }),
  archived: fc.boolean(),
  stars: fc.integer({ min: 0, max: 1_000_000 }),
});

describe("Feature: resurrection, Property 9: Fallback plan is valid, stable, deterministic and in tone", () => {
  /** **Validates: Requirements 7.5, 7.6, 7.7, 7.8** */
  it("every fallback plan validates against the schema, for any facts", () => {
    fc.assert(
      fc.property(factsArb, (facts) => {
        const plan = buildFallbackPlan(facts);
        expect(RevivalPlanSchema.safeParse(plan).success).toBe(true);
        for (const text of planStrings(plan)) {
          expect(sanitizePlanText(text)).toBe(text);
          expect(containsBannedWord(text)).toBe(false);
        }
        expect(countTaskItems(plan.issue.body)).toBeGreaterThanOrEqual(plan.roadmap.length);
        expect(buildFallbackPlan(facts)).toEqual(plan);
      }),
      { numRuns: 400 },
    );
  });

  it("the first roadmap step is never longer than a later one, and the verdict follows the status", () => {
    const minutes = (effort: string) => {
      const m = /^(\d+) min$/.exec(effort);
      if (m) return Number(m[1]);
      return effort === "1 hour" ? 60 : effort === "half a day" ? 240 : 480;
    };
    fc.assert(
      fc.property(factsArb, (facts) => {
        const plan = buildFallbackPlan(facts);
        const all = plan.roadmap.map((s) => minutes(s.effort));
        expect(all[0]).toBe(Math.min(...all));
        if (facts.status !== "ancient") expect(plan.verdict.decision).toBe("revive");
        expect(plan.verdict.decision).not.toBe("merge");
      }),
      { numRuns: 200 },
    );
  });
});
