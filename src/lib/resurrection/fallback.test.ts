import { describe, expect, it } from "vitest";
import { CAUSE_CODES, containsBannedWord } from "@/lib/epitaphs";
import type { Status } from "@/lib/scoring";
import { buildFallbackPlan, FALLBACK_TEMPLATES, fallbackLabel } from "./fallback";
import { RevivalPlanSchema, sanitizePlanText } from "./plan";
import { codePointLength } from "./text";

const STATUSES: Status[] = ["alive", "dying", "dead", "ancient"];

describe("buildFallbackPlan", () => {
  it("has a template for every cause code, including fading_health", () => {
    expect(Object.keys(FALLBACK_TEMPLATES).sort()).toEqual([...CAUSE_CODES].sort());
    expect(CAUSE_CODES).toContain("fading_health");
  });

  it("is valid, clean and in tone for every cause and status", () => {
    for (const causeCode of CAUSE_CODES) {
      for (const status of STATUSES) {
        const plan = buildFallbackPlan({ name: "todo-app", causeCode, status });
        expect(RevivalPlanSchema.safeParse(plan).success).toBe(true);
        for (const text of Object.values(plan)) {
          expect(containsBannedWord(text)).toBe(false);
          expect(sanitizePlanText(text)).toBe(text);
        }
        expect(codePointLength(plan.issueTitle)).toBeLessThanOrEqual(100);
        expect(plan.issueBody).not.toMatch(/[<@`]|!\[/);
        expect(plan.issueBody).toContain("- [ ]");
      }
    }
  });

  it("gives distinct plans for the causes", () => {
    const plans = CAUSE_CODES.map((causeCode) =>
      JSON.stringify(buildFallbackPlan({ name: "x", causeCode, status: "dead" })),
    );
    expect(new Set(plans).size).toBe(CAUSE_CODES.length);
  });

  it("handles empty, long and hostile names", () => {
    expect(fallbackLabel("")).toBe("this repo");
    expect(fallbackLabel("quit")).toBe("this repo");
    expect(fallbackLabel("a".repeat(100))).toHaveLength(60);
    expect(fallbackLabel("@bob `x` <b>hi</b>")).toBe("bob x bhib");
    const plan = buildFallbackPlan({ name: "@a`<i>", causeCode: "archived", status: "dead" });
    expect(RevivalPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.issueTitle).not.toMatch(/[@`<]/);
  });

  it("is deterministic", () => {
    const facts = { name: "n", causeCode: "fading_health", status: "dying" } as const;
    expect(buildFallbackPlan(facts)).toEqual(buildFallbackPlan(facts));
  });
});
