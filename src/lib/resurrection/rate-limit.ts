import type { WindowConfig } from "./limits";

export type WindowResult =
  | { allowed: true; timestamps: number[] }
  | { allowed: false; retryAfterSeconds: number; timestamps: number[] };

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** Pure sliding-window check. Non-finite or future timestamps count as `nowMs`. */
export function evaluateWindow(
  timestamps: readonly number[],
  nowMs: number,
  config: WindowConfig,
): WindowResult {
  const kept = timestamps
    .map((t) => (Number.isFinite(t) && t <= nowMs ? t : nowMs))
    .filter((t) => nowMs - t < config.windowMs)
    .sort((a, b) => a - b);
  if (kept.length < config.limit) {
    return { allowed: true, timestamps: [...kept, nowMs] };
  }
  const oldest = kept[0] ?? nowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((oldest + config.windowMs - nowMs) / 1000));
  return { allowed: false, retryAfterSeconds, timestamps: kept };
}

export type RateLimitStore = {
  check(key: string, nowMs: number): RateLimitDecision;
  size(): number;
};

/** In-memory store. The Map is an LRU: the least recently used key is dropped past `maxKeys`. */
export function createRateLimitStore(config: WindowConfig, maxKeys: number): RateLimitStore {
  const entries = new Map<string, number[]>();
  return {
    check(key, nowMs) {
      const result = evaluateWindow(entries.get(key) ?? [], nowMs, config);
      entries.delete(key);
      if (result.timestamps.length > 0) entries.set(key, result.timestamps);
      while (entries.size > maxKeys) {
        const oldestKey = entries.keys().next();
        if (oldestKey.done) break;
        entries.delete(oldestKey.value);
      }
      return result.allowed
        ? { allowed: true }
        : { allowed: false, retryAfterSeconds: result.retryAfterSeconds };
    },
    size() {
      return entries.size;
    },
  };
}
