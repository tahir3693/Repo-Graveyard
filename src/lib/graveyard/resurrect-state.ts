/**
 * Shape of a revival plan as the UI needs it. This mirrors the RevivalPlan in the
 * resurrection spec; replace it with the schema type once that module exists.
 */
export interface RevivalPlanData {
  diagnosis: string;
  smallestNextStep: string;
  effort: "under 1 hour" | "a weekend" | "a week or more";
  issueTitle: string;
  issueBody: string;
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
