import { describe, expect, it } from "vitest";
import { containsBannedWord } from "@/lib/epitaphs";
import type { Status } from "@/lib/scoring";
import {
  buildFallbackPlan,
  fallbackFactsFromBundle,
  fallbackLabel,
  type FallbackFacts,
} from "./fallback";
import { countTaskItems, planStrings, RevivalPlanSchema, sanitizePlanText } from "./plan";
import { makeBundle } from "./prompt.fixtures";
import { codePointLength } from "./text";

const STATUSES: Status[] = ["alive", "dying", "dead", "ancient"];

function facts(overrides: Partial<FallbackFacts> = {}): FallbackFacts {
  return {
    name: "todo-app",
    status: "dead",
    daysInactive: 412,
    ciState: "failing",
    failingChecks: 2,
    outdatedDeps: true,
    openIssues: 3,
    archived: false,
    stars: 5,
    ...overrides,
  };
}

/** Minutes of an effort text such as "15 min", "1 hour", "half a day". */
function minutesOf(effort: string): number {
  const min = /^(\d+) min$/.exec(effort);
  if (min) return Number(min[1]);
  const hours = /^(\d+) hours?$/.exec(effort);
  if (hours) return Number(hours[1]) * 60;
  if (effort === "half a day") return 240;
  if (effort === "a full day") return 480;
  throw new Error(`unknown effort text: ${effort}`);
}

function expectClean(plan: ReturnType<typeof buildFallbackPlan>) {
  expect(RevivalPlanSchema.safeParse(plan).success).toBe(true);
  for (const text of planStrings(plan)) {
    expect(containsBannedWord(text)).toBe(false);
    expect(sanitizePlanText(text)).toBe(text);
  }
  expect(codePointLength(plan.issue.title)).toBeLessThanOrEqual(100);
  expect(plan.issue.body).not.toMatch(/[<@]|!\[/);
  expect(countTaskItems(plan.issue.body)).toBeGreaterThanOrEqual(plan.roadmap.length);
  const minutes = plan.roadmap.map((s) => minutesOf(s.effort));
  expect(minutes[0]).toBe(Math.min(...minutes));
}

describe("buildFallbackPlan shape", () => {
  it("matches the schema for all four statuses", () => {
    for (const status of STATUSES) {
      const plan = buildFallbackPlan(facts({ status }));
      expectClean(plan);
      expect(plan.roadmap.length).toBeGreaterThanOrEqual(3);
      expect(plan.roadmap.length).toBeLessThanOrEqual(5);
      expect(plan.quickWins.length).toBeGreaterThanOrEqual(2);
      expect(plan.risks.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("matches the schema for every combination of signals", () => {
    for (const status of STATUSES) {
      for (const ciState of ["passing", "failing", "none"] as const) {
        for (const outdatedDeps of [true, false, null]) {
          for (const openIssues of [0, 1, 40]) {
            for (const archived of [true, false]) {
              for (const stars of [0, 7]) {
                for (const daysInactive of [null, 9_999]) {
                  expectClean(
                    buildFallbackPlan(
                      facts({
                        status,
                        ciState,
                        failingChecks: ciState === "failing" ? 2 : 0,
                        outdatedDeps,
                        openIssues,
                        archived,
                        stars,
                        daysInactive,
                      }),
                    ),
                  );
                }
              }
            }
          }
        }
      }
    }
  }, 30_000);

  it("is deterministic", () => {
    expect(buildFallbackPlan(facts())).toEqual(buildFallbackPlan(facts()));
  });
});

describe("verdict from status", () => {
  it("revives alive, dying and dead repos", () => {
    for (const status of ["alive", "dying", "dead"] as const) {
      expect(buildFallbackPlan(facts({ status })).verdict.decision).toBe("revive");
    }
  });

  it("revives an ancient repo that still has stars or open issues", () => {
    expect(buildFallbackPlan(facts({ status: "ancient", stars: 4, openIssues: 0 })).verdict.decision).toBe("revive");
    expect(buildFallbackPlan(facts({ status: "ancient", stars: 0, openIssues: 2 })).verdict.decision).toBe("revive");
  });

  it("archives an ancient repo with no stars and no open issues, with an archive roadmap", () => {
    const plan = buildFallbackPlan(facts({ status: "ancient", stars: 0, openIssues: 0 }));
    expect(plan.verdict.decision).toBe("archive");
    expect(plan.roadmap[0].title).toBe("Archive the repo");
    expect(plan.issue.title).toMatch(/^Archive /);
    expect(plan.issue.labels).toEqual(["archive"]);
    const archived = buildFallbackPlan(facts({ status: "ancient", stars: 0, openIssues: 0, archived: true }));
    expect(archived.roadmap.map((s) => s.title)).not.toContain("Archive the repo");
    expect(archived.roadmap.length).toBeGreaterThanOrEqual(3);
  });

  it("never returns merge, because the rules know of no other repo", () => {
    for (const status of STATUSES) {
      expect(buildFallbackPlan(facts({ status })).verdict.decision).not.toBe("merge");
    }
  });
});

describe("roadmap from real signals", () => {
  const titles = (f: FallbackFacts) => buildFallbackPlan(f).roadmap.map((s) => s.title);

  it("puts failing CI first, then dependencies, then issues, then silence", () => {
    expect(titles(facts({ openIssues: 3 }))).toEqual([
      "Read the first red check",
      "Fix the first red check",
      "List the outdated dependencies",
      "Update one dependency",
      "Read the open issues",
    ]);
  });

  it("starts with the smallest step even when CI is the top signal", () => {
    const plan = buildFallbackPlan(facts());
    expect(plan.roadmap[0].effort).toBe("15 min");
    expect(plan.roadmap[0].action).toContain("2 checks failing");
  });

  it("starts with unarchiving when the repo is archived", () => {
    const plan = buildFallbackPlan(facts({ archived: true }));
    expect(plan.roadmap[0].title).toBe("Unarchive the repo");
    expect(plan.roadmap[0].effort).toBe("5 min");
  });

  it("skips CI steps when CI passes and offers a CI step when there is none", () => {
    expect(titles(facts({ ciState: "passing", outdatedDeps: false, openIssues: 0, status: "alive" }))).not.toContain(
      "Read the first red check",
    );
    const none = titles(facts({ ciState: "none", outdatedDeps: false, openIssues: 0, status: "alive" }));
    expect(none).toContain("Add a minimal CI check");
    expect(none.length).toBeGreaterThanOrEqual(3);
  });

  it("handles a repo with no issues", () => {
    const plan = buildFallbackPlan(facts({ openIssues: 0 }));
    expect(plan.roadmap.map((s) => s.title)).not.toContain("Read the open issues");
    expect(plan.diagnosis).toContain("0 open issues");
  });

  it("uses silence and filler steps when no other signal exists", () => {
    const plan = buildFallbackPlan(
      facts({ ciState: "passing", outdatedDeps: false, openIssues: 0, status: "dead" }),
    );
    expect(plan.roadmap[0].title).toBe("Run it once");
    expect(plan.roadmap.length).toBeGreaterThanOrEqual(3);
  });

  it("names the counts only from the facts", () => {
    const plan = buildFallbackPlan(facts({ openIssues: 1 }));
    expect(plan.roadmap.map((s) => s.action).join(" ")).toContain("Read the 1 open issue,");
    expect(plan.verdict.reason).not.toMatch(/\d{3,}/);
  });
});

describe("null and unknown facts", () => {
  const unknown = facts({ daysInactive: null, outdatedDeps: null, ciState: "none", failingChecks: 0 });

  it("says unknown instead of guessing", () => {
    const plan = buildFallbackPlan(unknown);
    expectClean(plan);
    expect(plan.diagnosis).toContain("last commit date is unknown");
    expect(plan.diagnosis).toContain("dependency state is unknown");
    expect(plan.diagnosis).toContain("there is no CI");
    expect(plan.risks.join(" ")).toContain("unknown");
  });

  it("does not add dependency steps for unknown dependencies", () => {
    const titles = buildFallbackPlan(unknown).roadmap.map((s) => s.title);
    expect(titles).not.toContain("Update one dependency");
  });

  it("handles a failing CI with no known check count", () => {
    const plan = buildFallbackPlan(facts({ ciState: "failing", failingChecks: 0 }));
    expectClean(plan);
    expect(plan.diagnosis).toContain("CI is failing,");
  });
});

describe("effort", () => {
  it("is low for a short plan and grows with the work", () => {
    const small = buildFallbackPlan(
      facts({ ciState: "passing", outdatedDeps: false, openIssues: 0, status: "alive" }),
    );
    const big = buildFallbackPlan(facts());
    expect(small.effort.level).toBe("low");
    expect(big.effort.level).not.toBe("low");
    expect(big.effort.total.length).toBeGreaterThan(0);
  });
});

describe("issue", () => {
  it("holds the roadmap as a task list, in order", () => {
    const plan = buildFallbackPlan(facts());
    const lines = plan.issue.body.split("\n").filter((l) => l.startsWith("- [ ] "));
    expect(lines).toHaveLength(plan.roadmap.length);
    plan.roadmap.forEach((step, i) => expect(lines[i]).toContain(step.title));
  });

  it("limits and fills the labels from the signals", () => {
    const plan = buildFallbackPlan(facts());
    expect(plan.issue.labels).toEqual(["revival", "ci", "dependencies"]);
    const quiet = buildFallbackPlan(
      facts({ ciState: "passing", outdatedDeps: false, openIssues: 0, status: "alive" }),
    );
    expect(quiet.issue.labels).toEqual(["revival"]);
  });
});

describe("names", () => {
  it("handles empty, long and hostile names", () => {
    expect(fallbackLabel("")).toBe("this repo");
    expect(fallbackLabel("quit")).toBe("this repo");
    expect(fallbackLabel("a".repeat(100))).toHaveLength(60);
    expect(fallbackLabel("@bob `x` <b>hi</b>")).toBe("bob x bhib");
    const plan = buildFallbackPlan(facts({ name: "@a`<i>" }));
    expect(RevivalPlanSchema.safeParse(plan).success).toBe(true);
    expect(plan.issue.title).not.toMatch(/[@`<]/);
  });

  it("falls back to the generic name when the name would read as a link", () => {
    for (const name of ["www.example.com", "mailto", "javascript"]) {
      const plan = buildFallbackPlan(facts({ name }));
      expect(RevivalPlanSchema.safeParse(plan).success).toBe(true);
    }
  });

  it("builds facts from a context bundle", () => {
    const bundle = makeBundle({ ci: { state: "failing", failingChecks: ["build", "lint"] }, openIssues: 4 });
    expect(fallbackFactsFromBundle(bundle)).toEqual({
      name: "todo-app",
      status: "dead",
      daysInactive: 412,
      ciState: "failing",
      failingChecks: 2,
      outdatedDeps: null,
      openIssues: 4,
      archived: false,
      stars: 3,
    });
  });
});
