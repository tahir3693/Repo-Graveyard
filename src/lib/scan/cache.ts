import type { ScanData } from "../github/scan";

export const USER_CACHE_TTL_MS = 3_600_000;
export const DEMO_CACHE_TTL_MS = 300_000;

export type CacheEntry = { data: ScanData; includeForks: boolean; storedAt: number };

export type ScanCache = {
  get(key: string, nowMs: number, ttlMs: number, includeForks: boolean): CacheEntry | null;
  set(key: string, data: ScanData, includeForks: boolean, nowMs: number): void;
};

/** Creates an empty in-memory cache. Entries hold scan data only, never tokens or request data. */
export function createScanCache(): ScanCache {
  const entries = new Map<string, CacheEntry>();
  return {
    get(key, nowMs, ttlMs, includeForks) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (nowMs - entry.storedAt >= ttlMs) {
        entries.delete(key);
        return null;
      }
      return entry.includeForks === includeForks ? entry : null;
    },
    set(key, data, includeForks, nowMs) {
      entries.set(key, { data, includeForks, storedAt: nowMs });
    },
  };
}

const CACHE_KEY = Symbol.for("repo-graveyard.scan-cache");

function isScanCache(value: unknown): value is ScanCache {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    typeof value.get === "function" &&
    "set" in value &&
    typeof value.set === "function"
  );
}

/** Returns the process-wide cache, kept on globalThis so dev hot reload keeps it. */
export function getScanCache(): ScanCache {
  const existing: unknown = Reflect.get(globalThis, CACHE_KEY);
  if (isScanCache(existing)) return existing;
  const created = createScanCache();
  Reflect.set(globalThis, CACHE_KEY, created);
  return created;
}
