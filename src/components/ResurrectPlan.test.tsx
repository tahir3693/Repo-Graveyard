import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { makePlanData } from "@/lib/graveyard/plan.fixtures";
import type { RevivalPlanData } from "@/lib/graveyard/resurrect-state";
import {
  AI_PLAN_NOTE,
  COPIED_MESSAGE,
  COPY_FAILED_MESSAGE,
  DEMO_ISSUE_NOTE,
  FALLBACK_PLAN_NOTE,
  FILED_MESSAGE,
  FILING_MESSAGE,
  LABELS_NOTE,
  ResurrectPlan,
  issueStatusMessage,
  type CopyState,
  type IssueState,
} from "./ResurrectPlan";

const noop = () => undefined;

function render(
  over: { plan?: RevivalPlanData; demo?: boolean; issue?: IssueState; copy?: CopyState } = {},
) {
  return renderToStaticMarkup(
    <ResurrectPlan
      plan={over.plan ?? makePlanData()}
      demo={over.demo ?? false}
      issue={over.issue ?? { phase: "idle" }}
      copy={over.copy ?? "idle"}
      idPrefix="t"
      onCopy={noop}
      onFile={noop}
    />,
  );
}

/** The markup of one section, found by its heading id. */
function section(html: string, id: string): string {
  const start = html.lastIndexOf("<section", html.indexOf(`id="t-${id}"`));
  const end = html.indexOf("</section>", start);
  return html.slice(start, end + "</section>".length);
}

describe("ResurrectPlan layout", () => {
  it("shows the sections top to bottom in the requested order", () => {
    const html = render();
    const order = ["Verdict", "Diagnosis", "Revival roadmap", "Quick wins", "Risks", "Effort", "Drafted issue"].map(
      (title) => html.indexOf(`>${title}</h4>`),
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.indexOf(AI_PLAN_NOTE)).toBeGreaterThan(order[order.length - 1]);
  });

  it("keeps one heading hierarchy: h3 plan, h4 sections, h5 items, no h1 or h2", () => {
    const html = render();
    expect(html.match(/<h3[ >]/g)).toHaveLength(1);
    expect(html).toMatch(/<h3[^>]*tabindex="-1"[^>]*>Revival plan<\/h3>/);
    expect(html.match(/<h4[ >]/g)).toHaveLength(7);
    expect(html).not.toMatch(/<h[12][ >]/);
    // Step titles and the issue's sub-headings are h5. Nothing skips a level.
    expect(html.match(/<h5[ >]/g)!.length).toBeGreaterThanOrEqual(3 + 3);
    expect(html).not.toMatch(/<h6[ >]/);
  });

  it("labels every section by its heading", () => {
    const html = render();
    for (const id of ["verdict", "diagnosis", "roadmap", "wins", "risks", "effort", "issue"]) {
      expect(html).toContain(`aria-labelledby="t-${id}"`);
      expect(html).toContain(`id="t-${id}"`);
    }
  });
});

describe("1. verdict banner", () => {
  it.each([
    ["revive", "Revive"],
    ["archive", "Archive"],
    ["merge", "Merge"],
  ] as const)("shows a shape and the word for %s, plus the reason", (decision, word) => {
    const html = render({
      plan: makePlanData({ verdict: { decision, reason: "A one-line reason." } }),
    });
    const verdict = section(html, "verdict");
    expect(verdict).toContain(`plan-verdict-${decision}`);
    expect(verdict).toMatch(new RegExp(`<p class="plan-badge"><svg[^>]*aria-hidden="true"[^>]*>.*</svg>${word}</p>`));
    expect(verdict).toContain("A one-line reason.");
  });

  it("uses a different shape for each decision, so color is never the only cue", () => {
    const shapes = (["revive", "archive", "merge"] as const).map((decision) => {
      const html = render({ plan: makePlanData({ verdict: { decision, reason: "r" } }) });
      return /<path[^>]*d="([^"]+)"/.exec(section(html, "verdict"))?.[1];
    });
    expect(new Set(shapes).size).toBe(3);
  });
});

describe("2. diagnosis", () => {
  it("shows the diagnosis as a paragraph", () => {
    const html = render({ plan: makePlanData({ diagnosis: "A short diagnosis." }) });
    expect(section(html, "diagnosis")).toMatch(/<p class="resurrect-block-text">A short diagnosis\.<\/p>/);
  });
});

describe("3. revival roadmap", () => {
  const html = render();
  const roadmap = section(html, "roadmap");

  it("is an ordered list with one item per step, numbered", () => {
    expect(roadmap).toMatch(/<ol class="plan-steps" role="list">/);
    expect(roadmap.match(/<li class="plan-step">/g)).toHaveLength(3);
    expect(roadmap).toMatch(/plan-step-num" aria-hidden="true">1</);
    expect(roadmap).toMatch(/plan-step-num" aria-hidden="true">3</);
  });

  it("shows title, action, an effort chip and the why line for each step", () => {
    expect(roadmap).toContain(">Read the first red check</h5>");
    expect(roadmap).toContain("Open the latest failing check and read its first error line.");
    expect(roadmap).toMatch(/plan-chip">.*<span class="resurrect-sr-only">Effort: <\/span>15 min<\/span>/);
    expect(roadmap).toMatch(/plan-chip">.*half a day<\/span>/);
    expect(roadmap).toMatch(/<span class="plan-why-label">Why:<\/span> One error line shows where the repo stopped\./);
  });

  it('marks only the first step "Start here"', () => {
    expect(roadmap.match(/Start here/g)).toHaveLength(1);
    expect(roadmap.indexOf("Start here")).toBeLessThan(roadmap.indexOf("Fix the first red check"));
  });
});

describe("4. quick wins and risks", () => {
  const html = render();

  it("shows quick wins with a check marker", () => {
    const wins = section(html, "wins");
    expect(wins).toContain("Read the first error line.");
    expect(wins).toContain("Add one README line about what works.");
    expect(wins.match(/plan-icon plan-icon-win/g)).toHaveLength(2);
  });

  it("shows risks with a caution shape and a text label", () => {
    const risks = section(html, "risks");
    expect(risks).toContain(">Risks</h4>");
    expect(risks.match(/plan-icon plan-icon-risk/g)).toHaveLength(2);
    expect(risks.match(/Caution: /g)).toHaveLength(2);
    expect(risks).toContain("Fixing one check may reveal more red checks.");
  });

  it("puts the two sections in one wrapper that stacks on phones and splits on wide plans", () => {
    expect(html).toMatch(/<div class="plan-columns"><section[^>]*aria-labelledby="t-wins".*aria-labelledby="t-risks"/);
  });
});

describe("5. effort summary", () => {
  it.each([
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
  ] as const)("shows the %s level and the total time", (level, word) => {
    const html = render({ plan: makePlanData({ effort: { level, total: "about 3 days" } }) });
    const effort = section(html, "effort");
    expect(effort).toContain(`<strong>${word}</strong>`);
    expect(effort).toContain("about 3 days");
    expect(effort).toMatch(/plan-icon-level/);
  });
});

describe("6. drafted issue", () => {
  const html = render();
  const issue = section(html, "issue");

  it("shows the title and the body in a focusable scroll region", () => {
    expect(issue).toContain("Revive ghost-ledger: get the checks green");
    expect(issue).toMatch(/class="resurrect-issue-body" role="region" aria-label="Issue body, read-only preview" tabindex="0"/);
  });

  it("renders the task list as readable text with box shapes, not raw markdown", () => {
    const body = /class="resurrect-issue-body"[\s\S]*?<\/div>/.exec(issue)?.[0] ?? "";
    expect(body).toContain('<ul class="plan-tasks">');
    expect(body.match(/<li class="plan-task">/g)).toHaveLength(3);
    expect(body).toContain("Read the first red check (15 min): open the latest failing check");
    expect(body).not.toContain("- [ ]");
    expect(body).toContain("Roadmap:");
  });

  it("shows the labels as chips and says they are not added when filing", () => {
    expect(issue).toMatch(/<ul class="plan-labels" role="list"><li class="plan-chip">revival<\/li><li class="plan-chip">ci<\/li><\/ul>/);
    expect(issue).toContain(LABELS_NOTE);
  });

  it("leaves out the label list when there are no labels", () => {
    const none = section(render({ plan: makePlanData({ issue: { title: "T", body: "- [ ] a\n- [ ] b\n- [ ] c", labels: [] } }) }), "issue");
    expect(none).not.toContain("plan-labels");
    expect(none).not.toContain(LABELS_NOTE);
  });

  it("offers Copy issue, and File this issue enabled when signed in", () => {
    expect(issue).toContain("Copy issue");
    expect(issue).toMatch(/<button[^>]*>File this issue<\/button>/);
    expect(issue).not.toMatch(/<button[^>]*aria-disabled="true"[^>]*>File this issue/);
    expect(issue).not.toContain(DEMO_ISSUE_NOTE);
  });

  it("in demo mode disables File this issue and explains why", () => {
    const demo = section(render({ demo: true }), "issue");
    expect(demo).toMatch(/<button[^>]*aria-disabled="true"[^>]*>File this issue<\/button>/);
    expect(demo).toContain(DEMO_ISSUE_NOTE);
    expect(demo).toContain('aria-describedby="t-demo-note"');
    expect(demo).toContain('id="t-demo-note"');
  });

  it("disables File this issue while filing, without the demo explanation", () => {
    const pending = section(render({ issue: { phase: "pending" } }), "issue");
    expect(pending).toMatch(/<button[^>]*aria-disabled="true"[^>]*>File this issue<\/button>/);
    expect(pending).not.toContain("aria-describedby");
    expect(pending).toContain(FILING_MESSAGE);
  });

  it("shows a visible Copied confirmation", () => {
    const copied = render({ copy: "copied" });
    expect(copied).toContain("Copied");
    expect(copied).not.toContain(">Copy issue<");
    expect(copied).toContain(COPIED_MESSAGE);
  });

  it("replaces the buttons with a link once the issue is filed, and announces it", () => {
    const filed = section(render({ issue: { phase: "filed", url: "https://github.com/o/r/issues/1" } }), "issue");
    expect(filed).toContain('href="https://github.com/o/r/issues/1"');
    expect(filed).toContain(FILED_MESSAGE);
    expect(filed).not.toContain("File this issue");
  });

  it("shows a filing error as an alert", () => {
    const failed = section(render({ issue: { phase: "error", text: "GitHub would not take the issue." } }), "issue");
    expect(failed).toMatch(/<p class="resurrect-issue-error" role="alert">GitHub would not take the issue\.<\/p>/);
  });

  it("always renders the polite live region, empty when there is nothing to say", () => {
    expect(issue).toMatch(/<p class="resurrect-note" role="status" aria-live="polite"><\/p>/);
  });
});

describe("7. source line", () => {
  it('says "Written by AI" for an AI plan', () => {
    const html = render();
    expect(html).toContain(`<p class="plan-source">${AI_PLAN_NOTE}</p>`);
    expect(html).not.toContain(FALLBACK_PLAN_NOTE);
  });

  it("says honestly when the plan is the rule-based fallback", () => {
    const html = render({ plan: makePlanData({}, { fallback: true }) });
    expect(html).toContain(`<p class="plan-source">${FALLBACK_PLAN_NOTE}</p>`);
    expect(html).not.toContain(AI_PLAN_NOTE);
    expect(FALLBACK_PLAN_NOTE).toBe("Rule-based plan (the AI was unavailable)");
  });
});

describe("long text and untrusted text", () => {
  const long = "x".repeat(5000);

  it("renders very long unbroken text inside wrapping blocks", () => {
    const html = render({
      plan: makePlanData({
        diagnosis: long,
        verdict: { decision: "revive", reason: long },
        quickWins: [long, long],
        risks: [long],
        effort: { level: "high", total: long },
        issue: { title: long, body: `${long}\n- [ ] ${long}\n- [ ] b\n- [ ] c`, labels: [long] },
        roadmap: [
          { title: long, action: long, effort: long, why: long },
          { title: "b", action: "b", effort: "5 min", why: "b" },
          { title: "c", action: "c", effort: "5 min", why: "c" },
        ],
      }),
    });
    expect(html.split(long).length - 1).toBeGreaterThanOrEqual(12);
  });

  it("renders plan text as text, never as HTML", () => {
    const html = render({
      plan: makePlanData({ diagnosis: "<img src=x onerror=alert(1)> <b>bold</b>" }),
    });
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>bold");
  });
});

describe("issueStatusMessage", () => {
  it.each([
    [{ phase: "pending" } as const, "idle" as const, FILING_MESSAGE],
    [{ phase: "filed", url: null } as const, "idle" as const, FILED_MESSAGE],
    [{ phase: "idle" } as const, "copied" as const, COPIED_MESSAGE],
    [{ phase: "idle" } as const, "failed" as const, COPY_FAILED_MESSAGE],
    [{ phase: "idle" } as const, "idle" as const, null],
    [{ phase: "pending" } as const, "copied" as const, FILING_MESSAGE],
  ])("%j with copy %s says %s", (issue, copy, expected) => {
    expect(issueStatusMessage(issue, copy)).toBe(expected);
  });
});
