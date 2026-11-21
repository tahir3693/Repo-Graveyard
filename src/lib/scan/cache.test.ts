import { describe, expect, it } from "vitest";
import type { ScanData } from "../github/scan";
import { createScanCache, DEMO_CACHE_TTL_MS, getScanCache, USER_CACHE_TTL_MS } from "./cache";

const data = (skippedForks = 0): ScanData => ({
  repos: [],
  skippedForks,
  skippedInvalid: 0,
  truncated: false,
});

describe("scan cache", () => {
  it("exposes the TTL constants", () => {
    expect(USER_CACHE_TTL_MS).toBe(3_600_000);
    expect(DEMO_CACHE_TTL_MS).toBe(300_000);
  });

  it("returns the entry before the TTL elapses", () => {
    const cache = createScanCache();
    cache.set("user:a", data(), false, 1000);
    const hit = cache.get("user:a", 1000 + USER_CACHE_TTL_MS - 1, USER_CACHE_TTL_MS, false);
    expect(hit?.storedAt).toBe(1000);
  });

  it("misses at the TTL and deletes the entry", () => {
    const cache = createScanCache();
    cache.set("demo", data(), false, 1000);
    expect(cache.get("demo", 1000 + DEMO_CACHE_TTL_MS, DEMO_CACHE_TTL_MS, false)).toBeNull();
    expect(cache.get("demo", 1000, DEMO_CACHE_TTL_MS, false)).toBeNull();
  });

  it("replaces the existing entry", () => {
    const cache = createScanCache();
    cache.set("user:a", data(1), false, 1000);
    cache.set("user:a", data(2), false, 2000);
    const hit = cache.get("user:a", 2500, USER_CACHE_TTL_MS, false);
    expect(hit?.data.skippedForks).toBe(2);
    expect(hit?.storedAt).toBe(2000);
  });

  it("treats a different includeForks as a miss", () => {
    const cache = createScanCache();
    cache.set("user:a", data(), false, 1000);
    expect(cache.get("user:a", 1500, USER_CACHE_TTL_MS, true)).toBeNull();
  });

  it("stores no token field in an entry", () => {
    const cache = createScanCache();
    cache.set("user:a", data(), false, 1000);
    const hit = cache.get("user:a", 1500, USER_CACHE_TTL_MS, false);
    expect(Object.keys(hit ?? {}).sort()).toEqual(["data", "includeForks", "storedAt"]);
    expect(JSON.stringify(hit)).not.toMatch(/token|secret|session/i);
  });

  it("returns the same singleton across calls", () => {
    expect(getScanCache()).toBe(getScanCache());
  });
});
