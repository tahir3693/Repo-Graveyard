import { describe, expect, it } from "vitest";
import { createInFlightSet } from "./inflight";

describe("createInFlightSet", () => {
  it("refuses a busy key and accepts it after release", () => {
    const set = createInFlightSet();
    expect(set.acquire("a")).toBe(true);
    expect(set.acquire("a")).toBe(false);
    expect(set.acquire("b")).toBe(true);
    set.release("a");
    expect(set.acquire("a")).toBe(true);
  });

  it("ignores release of an unknown key", () => {
    const set = createInFlightSet();
    set.release("x");
    expect(set.acquire("x")).toBe(true);
  });
});
