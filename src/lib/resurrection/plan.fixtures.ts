import type { RevivalPlan } from "./plan";

/** A valid full plan. Tests override single fields to build invalid variants. */
export function makePlan(overrides: Partial<RevivalPlan> = {}): RevivalPlan {
  return {
    verdict: { decision: "revive", reason: "Quiet for a long while, yet one small step can wake it." },
    diagnosis:
      "todo-app is quiet for a long while, and its last commit was 412 days ago. CI is failing and 1 open issue is waiting. It is paused, not gone.",
    roadmap: [
      {
        title: "Read the first red check",
        action: "Open the latest failing check and read its first error line.",
        effort: "15 min",
        why: "One error line shows where the repo stopped.",
      },
      {
        title: "Fix the first red check",
        action: "Fix or skip that one error, push, and watch the checks again.",
        effort: "half a day",
        why: "Green checks make later changes safe.",
      },
      {
        title: "Read the open issues",
        action: "Read the open issue, close it if it is no longer true.",
        effort: "15 min",
        why: "Open issues are a ready-made to-do list.",
      },
    ],
    quickWins: ["Read the first error line.", "Add one README line about what works."],
    risks: ["Fixing one check may reveal more red checks."],
    effort: { level: "medium", total: "about a day" },
    issue: {
      title: "Revive todo-app: get the checks green",
      body: "todo-app is paused, not gone.\n\n- [ ] Read the first red check (15 min)\n- [ ] Fix the first red check (half a day)\n- [ ] Read the open issues (15 min)",
      labels: ["revival", "ci"],
    },
    ...overrides,
  };
}

export const VALID_PLAN: RevivalPlan = makePlan();
export const VALID_PLAN_TEXT = JSON.stringify(VALID_PLAN);
