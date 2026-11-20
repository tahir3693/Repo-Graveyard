import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  EFFORT_LABEL,
  initialResurrectState,
  resurrectReducer,
  type ResurrectAction,
  type ResurrectState,
  type RevivalPlanData,
} from "./resurrect-state";

const plan: RevivalPlanData = {
  diagnosis: "Paused after a breaking change.",
  smallestNextStep: "Bump the dependency and run the tests.",
  effort: "a weekend",
  issueTitle: "Revive: bump dependencies",
  issueBody: "Start by updating the lockfile.",
};

describe("resurrectReducer", () => {
  it("starts loading from idle", () => {
    expect(resurrectReducer(initialResurrectState, { type: "start" })).toEqual({
      phase: "loading",
    });
  });

  it("moves from loading to success with the plan", () => {
    const s = resurrectReducer({ phase: "loading" }, { type: "succeed", plan });
    expect(s).toEqual({ phase: "success", plan });
  });

  it("moves from loading to error", () => {
    expect(resurrectReducer({ phase: "loading" }, { type: "fail" })).toEqual({
      phase: "error",
    });
  });

  it("allows a retry from error", () => {
    expect(resurrectReducer({ phase: "error" }, { type: "start" })).toEqual({
      phase: "loading",
    });
  });

  it("ignores a second start while loading", () => {
    const loading: ResurrectState = { phase: "loading" };
    expect(resurrectReducer(loading, { type: "start" })).toBe(loading);
  });

  it("ignores results that arrive when nothing is in flight", () => {
    expect(resurrectReducer({ phase: "idle" }, { type: "succeed", plan })).toEqual({
      phase: "idle",
    });
    expect(resurrectReducer({ phase: "error" }, { type: "fail" })).toEqual({
      phase: "error",
    });
  });

  it("keeps the success state once reached", () => {
    const done: ResurrectState = { phase: "success", plan };
    expect(resurrectReducer(done, { type: "start" })).toBe(done);
    expect(resurrectReducer(done, { type: "fail" })).toBe(done);
  });

  // Feature: resurrection-animation, Property 1: success is only reachable through loading
  it("only reaches success from loading, for any action sequence", () => {
    const action = fc.constantFrom<ResurrectAction>(
      { type: "start" },
      { type: "succeed", plan },
      { type: "fail" },
    );
    fc.assert(
      fc.property(fc.array(action, { maxLength: 30 }), (actions) => {
        let state: ResurrectState = initialResurrectState;
        for (const a of actions) {
          const next = resurrectReducer(state, a);
          if (next.phase === "success" && state.phase !== "success") {
            expect(state.phase).toBe("loading");
          }
          state = next;
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe("EFFORT_LABEL", () => {
  it("has a label for every effort value", () => {
    expect(Object.keys(EFFORT_LABEL).sort()).toEqual(
      ["a week or more", "a weekend", "under 1 hour"].sort(),
    );
  });
});
