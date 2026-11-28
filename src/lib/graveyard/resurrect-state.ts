import type { EffortLevel, RevivalPlan } from "@/lib/resurrection/plan";

/**
 * Shape of a revival plan as the drawer needs it. `detail` is the full server plan
 * (verdict, roadmap, quick wins, risks, effort, issue and labels). The flat fields are
 * derived from it and feed the Copy and File actions.
 */
export interface RevivalPlanData {
  diagnosis: string;
  smallestNextStep: string;
  effort: "under 1 hour" | "a weekend" | "a week or more";
  issueTitle: string;
  issueBody: string;
  /** The full server plan. The drawer shows every section of it. */
  detail: RevivalPlan;
  /** Present (true) only when the rule-built fallback plan was used instead of the AI. */
  fallback?: true;
}

const EFFORT_BY_LEVEL: Record<EffortLevel, RevivalPlanData["effort"]> = {
  low: "under 1 hour",
  medium: "a weekend",
  high: "a week or more",
};

/** Maps the server plan onto the flat fields. The first roadmap step is the smallest next step. */
export function toPlanData(plan: RevivalPlan): RevivalPlanData {
  return {
    diagnosis: plan.diagnosis,
    smallestNextStep: plan.roadmap[0].action,
    effort: EFFORT_BY_LEVEL[plan.effort.level],
    issueTitle: plan.issue.title,
    issueBody: plan.issue.body,
    detail: plan,
  };
}

export type ResurrectState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "success"; plan: RevivalPlanData }
  | { phase: "error" };

export type ResurrectAction =
  | { type: "start" }
  | { type: "succeed"; plan: RevivalPlanData }
  | { type: "fail" };

export const initialResurrectState: ResurrectState = { phase: "idle" };

/**
 * One request at a time: `start` is ignored while loading and after success,
 * and results are only accepted while a request is in flight.
 */
export function resurrectReducer(
  state: ResurrectState,
  action: ResurrectAction,
): ResurrectState {
  switch (action.type) {
    case "start":
      return state.phase === "idle" || state.phase === "error"
        ? { phase: "loading" }
        : state;
    case "succeed":
      return state.phase === "loading"
        ? { phase: "success", plan: action.plan }
        : state;
    case "fail":
      return state.phase === "loading" ? { phase: "error" } : state;
  }
}

export const EFFORT_LABEL: Record<RevivalPlanData["effort"], string> = {
  "under 1 hour": "Under 1 hour",
  "a weekend": "A weekend",
  "a week or more": "A week or more",
};
