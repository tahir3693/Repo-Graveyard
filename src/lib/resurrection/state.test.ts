import { describe, expect, it } from "vitest";
import { getResurrectionState } from "./state";

describe("getResurrectionState", () => {
  it("returns the same state on every call and stores it on globalThis", () => {
    const first = getResurrectionState();
    expect(getResurrectionState()).toBe(first);
    expect(Reflect.get(globalThis, Symbol.for("repo-graveyard.resurrection"))).toBe(first);
  });

  it("holds independent stores and an in-flight set", () => {
    const state = getResurrectionState();
    expect(state.resurrect).not.toBe(state.demo);
    expect(state.demo).not.toBe(state.issue);
    expect(state.inFlight.acquire("state-test")).toBe(true);
    state.inFlight.release("state-test");
  });

  it("applies the 10, 20 and 5 limits", () => {
    const state = getResurrectionState();
    const count = (store: typeof state.issue, key: string) => {
      let allowed = 0;
      for (let i = 0; i < 30; i++) if (store.check(key, 5_000).allowed) allowed++;
      return allowed;
    };
    expect(count(state.resurrect, "r")).toBe(10);
    expect(count(state.demo, "d")).toBe(20);
    expect(count(state.issue, "i")).toBe(5);
  });
});
