/**
 * Retry orchestration over an injected `call`. Pure apart from awaiting `call`.
 * The same `call` (one closed-over request) is used for every attempt, so the
 * retry request equals the first and never contains a failed output.
 */
import type { LlmFailureKind, LlmResult } from "@/lib/llm";

import { parsePlan, type RevivalPlan } from "./plan";
import type { FallbackReason } from "./response";

export type AttemptsResult = { ok: true; plan: RevivalPlan } | { ok: false; lastKind: LlmFailureKind };

/**
 * `isAcceptable` is an optional extra gate on a parsed plan (used to reject
 * plans that contain a known secret). A rejected plan counts as `invalid_output`.
 */
export async function runAttempts(
  call: () => Promise<LlmResult>,
  maxAttempts: number,
  isAcceptable: (plan: RevivalPlan) => boolean = () => true,
): Promise<AttemptsResult> {
  let lastKind: LlmFailureKind = "unavailable";
  // A failure with `retryable: false` (401, 403, 404, ...) ends the loop: a retry cannot help.
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let result: LlmResult;
    try {
      result = await call();
    } catch {
      lastKind = "unavailable";
      continue;
    }
    if (!result.ok) {
      lastKind = result.kind;
      if (result.retryable === false) break;
      continue;
    }
    const parsed = parsePlan(result.text);
    if (parsed.ok && isAcceptable(parsed.plan)) return { ok: true, plan: parsed.plan };
    lastKind = "invalid_output";
  }
  return { ok: false, lastKind };
}

export function toFallbackReason(kind: LlmFailureKind): FallbackReason {
  switch (kind) {
    case "timeout":
      return "llm_timeout";
    case "unavailable":
      return "llm_unavailable";
    case "invalid_output":
      return "llm_invalid_output";
  }
}
