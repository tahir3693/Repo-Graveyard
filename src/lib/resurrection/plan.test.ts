import { describe, expect, it } from "vitest";
import { PLAN_FIELD_LIMITS as F, RESURRECTION_LIMITS as L } from "./limits";
import {
  cleanModelText,
  parsePlan,
  planStrings,
  RevivalPlanSchema,
  sanitizePlanText,
  stripLinks,
  type RevivalPlan,
} from "./plan";
import { makePlan } from "./plan.fixtures";
import type { RevivalPlanData } from "@/lib/graveyard/resurrect-state";
import { toPlanData } from "@/lib/graveyard/resurrect-state";

const plan = makePlan();
const long = (n: number) => "a".repeat(n);

function parseWith(change: (p: RevivalPlan) => unknown) {
  return parsePlan(JSON.stringify(change(structuredClone(plan))));
}

describe("parsePlan: shape", () => {
  it("accepts a valid full plan, bare or fenced", () => {
    expect(parsePlan(JSON.stringify(plan))).toEqual({ ok: true, plan });
    expect(parsePlan("```json\n" + JSON.stringify(plan) + "\n```")).toEqual({ ok: true, plan });
    expect(parsePlan("```\n" + JSON.stringify(plan) + "\n```")).toEqual({ ok: true, plan });
  });

  it("rejects prose around the object, arrays and non-strings", () => {
    const json = JSON.stringify(plan);
    expect(parsePlan("Here you go: " + json)).toEqual({ ok: false });
    expect(parsePlan(json + " Hope that helps")).toEqual({ ok: false });
    expect(parsePlan(JSON.stringify([plan]))).toEqual({ ok: false });
    expect(parsePlan("")).toEqual({ ok: false });
    expect(parsePlan(null)).toEqual({ ok: false });
    expect(parsePlan(42)).toEqual({ ok: false });
  });

  it("rejects raw text longer than LLM_RAW_MAX_CHARS", () => {
    const pad = " ".repeat(L.LLM_RAW_MAX_CHARS + 1 - JSON.stringify(plan).length);
    expect(parsePlan(JSON.stringify(plan) + pad)).toEqual({ ok: false });
  });

  it.each(["verdict", "diagnosis", "roadmap", "quickWins", "risks", "effort", "issue"] as const)(
    "rejects a plan with the %s section missing",
    (key) => {
      expect(parseWith((p) => ({ ...p, [key]: undefined }))).toEqual({ ok: false });
    },
  );

  it("discards extra fields at every level", () => {
    const result = parseWith((p) => ({
      ...p,
      extra: "x",
      verdict: { ...p.verdict, note: "y" },
      roadmap: p.roadmap.map((s) => ({ ...s, extra: 1 })),
    }));
    expect(result).toEqual({ ok: true, plan });
  });

  it("rejects an unknown decision or effort level", () => {
    expect(parseWith((p) => ({ ...p, verdict: { ...p.verdict, decision: "delete" } }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, effort: { ...p.effort, level: "Low" } }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, effort: "a weekend" }))).toEqual({ ok: false });
  });

  it("accepts every decision", () => {
    for (const decision of ["revive", "archive", "merge"] as const) {
      expect(parseWith((p) => ({ ...p, verdict: { ...p.verdict, decision } })).ok).toBe(true);
    }
  });
});

describe("parsePlan: counts", () => {
  const step = plan.roadmap[0];
  const body = (n: number) => Array.from({ length: n }, (_, i) => `- [ ] step ${i}`).join("\n");

  it("needs 3 to 5 roadmap steps", () => {
    expect(parseWith((p) => ({ ...p, roadmap: p.roadmap.slice(0, 2) }))).toEqual({ ok: false });
    for (const n of [3, 4, 5]) {
      const result = parseWith((p) => ({
        ...p,
        roadmap: Array.from({ length: n }, () => step),
        issue: { ...p.issue, body: body(n) },
      }));
      expect(result.ok).toBe(true);
    }
    expect(
      parseWith((p) => ({
        ...p,
        roadmap: Array.from({ length: 6 }, () => step),
        issue: { ...p.issue, body: body(6) },
      })),
    ).toEqual({ ok: false });
  });

  it("needs 2 to 3 quick wins and 1 to 3 risks", () => {
    expect(parseWith((p) => ({ ...p, quickWins: ["a"] }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, quickWins: ["a", "b", "c", "d"] }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, risks: [] }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, risks: ["a", "b", "c", "d"] }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, risks: ["a", "b", "c"] })).ok).toBe(true);
  });

  it("allows at most 3 labels, each short and plain", () => {
    expect(parseWith((p) => ({ ...p, issue: { ...p.issue, labels: [] } })).ok).toBe(true);
    expect(parseWith((p) => ({ ...p, issue: { ...p.issue, labels: ["a", "b", "c", "d"] } }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, issue: { ...p.issue, labels: [long(F.LABEL + 1)] } }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, issue: { ...p.issue, labels: ["bug, urgent"] } }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, issue: { ...p.issue, labels: ["a\nb"] } }))).toEqual({ ok: false });
  });
});

describe("parsePlan: issue body holds the roadmap as a task list", () => {
  it("rejects a body without a task list", () => {
    expect(parseWith((p) => ({ ...p, issue: { ...p.issue, body: "Just prose." } }))).toEqual({ ok: false });
  });

  it("rejects a body with fewer task items than roadmap steps", () => {
    expect(parseWith((p) => ({ ...p, issue: { ...p.issue, body: "- [ ] one\n- [ ] two" } }))).toEqual({ ok: false });
  });

  it("accepts star bullets and checked boxes", () => {
    const body = "Intro\n\n* [ ] one\n- [x] two\n  - [ ] three";
    expect(parseWith((p) => ({ ...p, issue: { ...p.issue, body } })).ok).toBe(true);
  });
});

describe("parsePlan: length limits", () => {
  const cases: Array<[string, number, (p: RevivalPlan, v: string) => unknown]> = [
    ["verdict.reason", F.VERDICT_REASON, (p, v) => ({ ...p, verdict: { ...p.verdict, reason: v } })],
    ["diagnosis", L.PLAN_DIAGNOSIS_MAX, (p, v) => ({ ...p, diagnosis: v })],
    ["step title", F.STEP_TITLE, (p, v) => ({ ...p, roadmap: [{ ...p.roadmap[0], title: v }, ...p.roadmap.slice(1)] })],
    ["step action", L.PLAN_STEP_MAX, (p, v) => ({ ...p, roadmap: [{ ...p.roadmap[0], action: v }, ...p.roadmap.slice(1)] })],
    ["step effort", F.STEP_EFFORT, (p, v) => ({ ...p, roadmap: [{ ...p.roadmap[0], effort: v }, ...p.roadmap.slice(1)] })],
    ["step why", F.STEP_WHY, (p, v) => ({ ...p, roadmap: [{ ...p.roadmap[0], why: v }, ...p.roadmap.slice(1)] })],
    ["quick win", F.QUICK_WIN, (p, v) => ({ ...p, quickWins: [v, "b"] })],
    ["risk", F.RISK, (p, v) => ({ ...p, risks: [v] })],
    ["effort.total", F.EFFORT_TOTAL, (p, v) => ({ ...p, effort: { ...p.effort, total: v } })],
    ["issue.title", L.PLAN_TITLE_MAX, (p, v) => ({ ...p, issue: { ...p.issue, title: v } })],
    ["issue.body", L.PLAN_BODY_MAX, (p, v) => ({ ...p, issue: { ...p.issue, body: p.issue.body + "\n" + v } })],
  ];

  it.each(cases)("accepts %s at its limit and rejects one over", (_name, max, change) => {
    const base = plan.issue.body.length;
    // The body case pads to exactly the limit, so account for the existing body and newline.
    const fill = (n: number) => long(_name === "issue.body" ? n - base - 1 : n);
    expect(parsePlan(JSON.stringify(change(structuredClone(plan), fill(max)))).ok).toBe(true);
    expect(parsePlan(JSON.stringify(change(structuredClone(plan), fill(max + 1))))).toEqual({ ok: false });
  });

  it("rejects very long fields of every kind", () => {
    const huge = long(5_000);
    for (const [, , change] of cases) {
      expect(parsePlan(JSON.stringify(change(structuredClone(plan), huge)))).toEqual({ ok: false });
    }
  });

  it("rejects blank fields and line breaks in one-line fields", () => {
    expect(parseWith((p) => ({ ...p, diagnosis: "   " }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, issue: { ...p.issue, title: "a\nb" } }))).toEqual({ ok: false });
    expect(parseWith((p) => ({ ...p, verdict: { ...p.verdict, reason: "a\nb" } }))).toEqual({ ok: false });
  });

  it("applies length limits after sanitizing", () => {
    const title = "<b>" + long(L.PLAN_TITLE_MAX) + "</b>";
    expect(parseWith((p) => ({ ...p, issue: { ...p.issue, title } })).ok).toBe(true);
  });
});

describe("parsePlan: no HTML and no links", () => {
  function reasonOf(text: string) {
    const result = parseWith((p) => ({ ...p, verdict: { ...p.verdict, reason: text } }));
    return result.ok ? result.plan.verdict.reason : null;
  }

  it("strips HTML tags", () => {
    expect(reasonOf("a <b>bold</b> <script>x</script> move")).toBe("a bold x move");
  });

  it("keeps the text of a markdown link and drops the address", () => {
    expect(reasonOf("See [the docs](https://example.com/x) first")).toBe("See the docs first");
  });

  it("drops bare URLs, www addresses and active schemes", () => {
    expect(reasonOf("Visit https://example.com/a?b=1 now")).toBe("Visit  now");
    expect(reasonOf("Visit www.example.com now")).toBe("Visit  now");
    expect(reasonOf("Click javascript:alert(1) now")).toBe("Click  now");
    expect(reasonOf("Write mailto:a@b.c now")).toBe("Write  now");
  });

  it("drops images and wraps mentions", () => {
    expect(reasonOf("![logo](https://e.com/x.png) cc @octocat")).toBe("logo cc `@octocat`");
  });

  it("rejects text where a link cannot be stripped cleanly", () => {
    expect(reasonOf("broken [a](b link")).toBeNull();
  });

  it("strips links inside lists and the issue body", () => {
    const result = parseWith((p) => ({
      ...p,
      quickWins: ["Read http://e.com/a first", "Second"],
      issue: { ...p.issue, body: p.issue.body + "\n\nMore: [x](https://e.com)" },
    }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.quickWins[0]).toBe("Read  first");
      expect(result.plan.issue.body).toContain("More: x");
      expect(planStrings(result.plan).join("\n")).not.toMatch(/https?:|www\./);
    }
  });

  it("the schema itself rejects a link that was not cleaned", () => {
    const dirty = makePlan({ verdict: { decision: "revive", reason: "see https://e.com" } });
    expect(RevivalPlanSchema.safeParse(dirty).success).toBe(false);
    const html = makePlan({ diagnosis: "a <i>b</i>" });
    expect(RevivalPlanSchema.safeParse(html).success).toBe(false);
  });
});

describe("planStrings", () => {
  it("lists every text of the plan", () => {
    const all = planStrings(plan);
    expect(all).toContain(plan.verdict.reason);
    expect(all).toContain(plan.roadmap[2].why);
    expect(all).toContain(plan.effort.total);
    expect(all).toContain(plan.issue.labels[1]);
    expect(all).toContain(plan.issue.body);
  });
});

describe("toPlanData (drawer compatibility)", () => {
  it("keeps the flat fields the drawer reads", () => {
    const data: RevivalPlanData = toPlanData(plan);
    expect(data.diagnosis).toBe(plan.diagnosis);
    expect(data.smallestNextStep).toBe(plan.roadmap[0].action);
    expect(data.issueTitle).toBe(plan.issue.title);
    expect(data.issueBody).toBe(plan.issue.body);
    expect(data.effort).toBe("a weekend");
    expect(data.detail).toEqual(plan);
  });

  it("maps each effort level", () => {
    expect(toPlanData({ ...plan, effort: { level: "low", total: "x" } }).effort).toBe("under 1 hour");
    expect(toPlanData({ ...plan, effort: { level: "high", total: "x" } }).effort).toBe("a week or more");
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

  it("wraps mentions and leaves mentions inside backticks alone", () => {
    expect(sanitizePlanText("ping @user now")).toBe("ping `@user` now");
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

describe("stripLinks and cleanModelText", () => {
  it("stripLinks removes link syntax", () => {
    expect(stripLinks("[a](b) https://x.y www.z.com")).toBe("a  ");
  });

  it("cleanModelText applies markup, mention and link cleaning together", () => {
    expect(cleanModelText("<b>hi</b> @bob [x](http://y.z)")).toBe("hi `@bob` x");
  });
});
