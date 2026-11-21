import { describe, expect, it } from "vitest";
import { RESURRECT_LIMIT, RESURRECTION_LIMITS } from "./limits";
import { createRateLimitStore, evaluateWindow } from "./rate-limit";

const NOW = 1_000_000_000;

function fill(count: number): number[] {
  return Array.from({ length: count }, () => NOW);
}

describe("evaluateWindow", () => {
  it("allows the 10th call and denies the 11th with retryAfterSeconds >= 1", () => {
    const tenth = evaluateWindow(fill(9), NOW, RESURRECT_LIMIT);
    expect(tenth.allowed).toBe(true);
    expect(tenth.timestamps).toHaveLength(10);
    const eleventh = evaluateWindow(tenth.timestamps, NOW, RESURRECT_LIMIT);
    expect(eleventh.allowed).toBe(false);
    if (!eleventh.allowed) expect(eleventh.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("allows again exactly 600,000 ms later", () => {
    const result = evaluateWindow(fill(10), NOW + 600_000, RESURRECT_LIMIT);
    expect(result.allowed).toBe(true);
  });

  it("denies 1 ms before the window ends and reports the wait", () => {
    const result = evaluateWindow(fill(10), NOW + 599_999, RESURRECT_LIMIT);
    expect(result).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
  });

  it("does not record a denied call", () => {
    const result = evaluateWindow(fill(10), NOW + 1, RESURRECT_LIMIT);
    expect(result.allowed).toBe(false);
    expect(result.timestamps).toHaveLength(10);
  });

  it("treats a future timestamp as now", () => {
    const result = evaluateWindow([NOW + 5_000_000], NOW, RESURRECT_LIMIT);
    expect(result.timestamps).toEqual([NOW, NOW]);
  });

  it("treats NaN and Infinity as now", () => {
    const result = evaluateWindow([Number.NaN, Number.POSITIVE_INFINITY], NOW, RESURRECT_LIMIT);
    expect(result.timestamps).toEqual([NOW, NOW, NOW]);
  });
});

describe("createRateLimitStore", () => {
  it("limits per key", () => {
    const store = createRateLimitStore(RESURRECT_LIMIT, 10);
    for (let i = 0; i < 10; i++) expect(store.check("a", NOW).allowed).toBe(true);
    expect(store.check("a", NOW).allowed).toBe(false);
    expect(store.check("b", NOW).allowed).toBe(true);
  });

  it("evicts the least recently used key at MAX_TRACKED_KEYS", () => {
    const max = RESURRECTION_LIMITS.MAX_TRACKED_KEYS;
    const store = createRateLimitStore(RESURRECT_LIMIT, max);
    for (let i = 0; i < max; i++) store.check(`k${i}`, NOW);
    expect(store.size()).toBe(max);
    store.check("k0", NOW);
    store.check("new", NOW);
    expect(store.size()).toBe(max);
    // k1 was evicted (k0 was refreshed), so it starts fresh
    for (let i = 0; i < 9; i++) store.check("k0", NOW);
    expect(store.check("k0", NOW).allowed).toBe(false);
    expect(store.check("k1", NOW).allowed).toBe(true);
  });
});
