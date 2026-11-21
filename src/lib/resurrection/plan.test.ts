import { describe, expect, it } from "vitest";
import { RESURRECTION_LIMITS } from "./limits";
import { EFFORTS, parsePlan, sanitizePlanText, type RevivalPlan } from "./plan";
import type { RevivalPlanData } from "@/lib/graveyard/resurrect-state";

const plan: RevivalPlan = {
  diagnosis: "Paused since March. Dependencies drifted.",
  smallestNextStep: "Run the tests and read the first failure.",
  effort: "a weekend",
  issueTitle: "Revive: update dependencies",
  issueBody: "- [ ] Update deps\n- [ ] Fix tests",
};

describe("parsePlan", () => {
  it("accepts a bare JSON object", () => {
    expect(parsePlan(JSON.stringify(plan))).toEqual({ ok: true, plan });
  });

  it("accepts a fence with the word json", () => {
    expect(parsePlan("```json\n" + JSON.stringify(plan) + "\n```")).toEqual({ ok: true, plan });
  });

  it("accepts a fence without a language word", () => {
    expect(parsePlan("```\n" + JSON.stringify(plan) + "\n```")).toEqual({ ok: true, plan });
  });

  it("rejects prose before or after the object", () => {
    const json = JSON.stringify(plan);
    expect(parsePlan("Here you go: " + json)).toEqual({ ok: false });
    expect(parsePlan(json + " Hope that helps")).toEqual({ ok: false });
  });

  it("rejects an array", () => {
    expect(parsePlan(JSON.stringify([plan]))).toEqual({ ok: false });
  });

  it("rejects an effort with different case", () => {
    expect(parsePlan(JSON.stringify({ ...plan, effort: "A weekend" }))).toEqual({ ok: false });
  });

  it("rejects a missing field", () => {
    const { issueBody: _omit, ...rest } = plan;
    void _omit;
    expect(parsePlan(JSON.stringify(rest))).toEqual({ ok: false });
  });

  it("discards an extra field", () => {
    const result = parsePlan(JSON.stringify({ ...plan, extra: "x" }));
    expect(result).toEqual({ ok: true, plan });
    if (result.ok) expect(Object.keys(result.plan).sort()).toEqual(Object.keys(plan).sort());
  });

  it("rejects the empty string and non-strings", () => {
    expect(parsePlan("")).toEqual({ ok: false });
    expect(parsePlan(null)).toEqual({ ok: false });
    expect(parsePlan(42)).toEqual({ ok: false });
  });

  it("rejects raw text longer than LLM_RAW_MAX_CHARS", () => {
    const pad = " ".repeat(RESURRECTION_LIMITS.LLM_RAW_MAX_CHARS + 1 - JSON.stringify(plan).length);
    const long = JSON.stringify(plan) + pad;
    expect(long.length).toBe(RESURRECTION_LIMITS.LLM_RAW_MAX_CHARS + 1);
    expect(parsePlan(long)).toEqual({ ok: false });
  });

  it("rejects whitespace-only fields and line breaks in the title", () => {
    expect(parsePlan(JSON.stringify({ ...plan, diagnosis: "   " }))).toEqual({ ok: false });
    expect(parsePlan(JSON.stringify({ ...plan, issueTitle: "a\nb" }))).toEqual({ ok: false });
  });

  it("applies length limits after sanitizing", () => {
    const title = "<b>" + "a".repeat(RESURRECTION_LIMITS.PLAN_TITLE_MAX) + "</b>";
    const result = parsePlan(JSON.stringify({ ...plan, issueTitle: title }));
    expect(result.ok).toBe(true);
  });

  it("sanitizes mentions and images in fields", () => {
    const result = parsePlan(JSON.stringify({ ...plan, issueBody: "cc @octocat ![x](http://e.com/a.png)" }));
    expect(result).toEqual({ ok: true, plan: { ...plan, issueBody: "cc `@octocat` x" } });
  });

  it("is structurally compatible with RevivalPlanData", () => {
    const data: RevivalPlanData = plan;
    const back: RevivalPlan = data;
    expect(back).toBe(plan);
    expect([...EFFORTS]).toEqual(["under 1 hour", "a weekend", "a week or more"]);
  });
});

describe("sanitizePlanText", () => {
  it("removes HTML tags", () => {
    expect(sanitizePlanText("a <b>bold</b> <script>x</script>")).toBe("a bold x");
  });

  it("replaces images with alt text", () => {
    expect(sanitizePlanText("![logo](https://e.com/x.png)")).toBe("logo");
    expect(sanitizePlanText("![![a](b)](c)")).not.toContain("![");
  });

  it("wraps mentions", () => {
    expect(sanitizePlanText("ping @user now")).toBe("ping `@user` now");
  });

  it("leaves mentions inside backticks alone", () => {
    expect(sanitizePlanText("run `@user` now")).toBe("run `@user` now");
  });

  it("handles an unclosed backtick and stays idempotent", () => {
    const once = sanitizePlanText("a ` b @user");
    expect(once).not.toMatch(/(^|[^`])@user/);
    expect(sanitizePlanText(once)).toBe(once);
  });

  it("removes control and bidi characters but keeps newlines", () => {
    expect(sanitizePlanText("a\u0000b\u202Ec\r\nd\te")).toBe("abc\nde");
  });
});
