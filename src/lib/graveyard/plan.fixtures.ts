/**
 * Test fixtures for the drawer. They live here (not in lib/resurrection) because client
 * code and its tests may import only the client-safe resurrection modules.
 */
import type { RevivalPlan } from "@/lib/resurrection/plan";
import { toPlanData, type RevivalPlanData } from "./resurrect-state";

export function makeDetail(overrides: Partial<RevivalPlan> = {}): RevivalPlan {
  return {
    verdict: { decision: "revive", reason: "Quiet for a long while, yet one small step can wake it." },
    diagnosis:
      "ghost-ledger is quiet for a long while, and its last commit was 412 days ago. CI is failing and 3 open issues are waiting. It is paused, not gone.",
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
        action: "Read the 3 open issues and pick one to do first.",
        effort: "15 min",
        why: "Open issues are a ready-made to-do list.",
      },
    ],
    quickWins: ["Read the first error line.", "Add one README line about what works."],
    risks: ["Fixing one check may reveal more red checks.", "The original goal may no longer fit."],
    effort: { level: "medium", total: "about a day" },
    issue: {
      title: "Revive ghost-ledger: get the checks green",
      body: "ghost-ledger is paused, not gone.\n\nRoadmap:\n\n- [ ] Read the first red check (15 min): open the latest failing check\n- [ ] Fix the first red check (half a day): fix that one error\n- [ ] Read the open issues (15 min): pick one to do first",
      labels: ["revival", "ci"],
    },
    ...overrides,
  };
}

export function makePlanData(
  overrides: Partial<RevivalPlan> = {},
  extra: { fallback?: true } = {},
): RevivalPlanData {
  return { ...toPlanData(makeDetail(overrides)), ...extra };
}
