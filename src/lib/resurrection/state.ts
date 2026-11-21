import { createInFlightSet, type InFlightSet } from "./inflight";
import {
  DEMO_RESURRECT_LIMIT,
  ISSUE_LIMIT,
  RESURRECT_LIMIT,
  RESURRECTION_LIMITS,
} from "./limits";
import { createRateLimitStore, type RateLimitStore } from "./rate-limit";

export type ResurrectionState = {
  resurrect: RateLimitStore;
  demo: RateLimitStore;
  issue: RateLimitStore;
  inFlight: InFlightSet;
};

const STATE_KEY = Symbol.for("repo-graveyard.resurrection");

function isFn(value: object, name: string): boolean {
  return name in value && typeof Reflect.get(value, name) === "function";
}

function isStore(value: unknown): value is RateLimitStore {
  return typeof value === "object" && value !== null && isFn(value, "check") && isFn(value, "size");
}

function isInFlight(value: unknown): value is InFlightSet {
  return (
    typeof value === "object" && value !== null && isFn(value, "acquire") && isFn(value, "release")
  );
}

function isState(value: unknown): value is ResurrectionState {
  return (
    typeof value === "object" &&
    value !== null &&
    "resurrect" in value &&
    isStore(value.resurrect) &&
    "demo" in value &&
    isStore(value.demo) &&
    "issue" in value &&
    isStore(value.issue) &&
    "inFlight" in value &&
    isInFlight(value.inFlight)
  );
}

/** Returns the process-wide state, kept on globalThis so dev hot reload keeps it. */
export function getResurrectionState(): ResurrectionState {
  const existing: unknown = Reflect.get(globalThis, STATE_KEY);
  if (isState(existing)) return existing;
  const max = RESURRECTION_LIMITS.MAX_TRACKED_KEYS;
  const created: ResurrectionState = {
    resurrect: createRateLimitStore(RESURRECT_LIMIT, max),
    demo: createRateLimitStore(DEMO_RESURRECT_LIMIT, max),
    issue: createRateLimitStore(ISSUE_LIMIT, max),
    inFlight: createInFlightSet(),
  };
  Reflect.set(globalThis, STATE_KEY, created);
  return created;
}
