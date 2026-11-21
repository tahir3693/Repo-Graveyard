import { describe, expect, it } from "vitest";
import type { LlmResult } from "@/lib/llm";
import { runAttempts, toFallbackReason } from "./attempts";

const VALID = JSON.stringify({
  diagnosis: "Paused.",
  smallestNextStep: "Run it.",
  effort: "a weekend",
  issueTitle: "Revive it",
  issueBody: "- [ ] go",
});
const good: LlmResult = { ok: true, text: VALID };
const bad: LlmResult = { ok: true, text: "not json" };
const timeout: LlmResult = { ok: false, kind: "timeout" };

function scripted(results: Array<LlmResult | "throw">) {
  let calls = 0;
  const call = async (): Promise<LlmResult> => {
    const r = results[Math.min(calls, results.length - 1)];
    calls += 1;
    if (r === "throw") throw new Error("boom");
    return r;
  };
  return { call, count: () => calls };
}

describe("runAttempts", () => {
  it("valid first: one call", async () => {
    const s = scripted([good]);
    expect((await runAttempts(s.call, 2)).ok).toBe(true);
    expect(s.count()).toBe(1);
  });
  it("invalid then valid: two calls, plan", async () => {
    const s = scripted([bad, good]);
    expect((await runAttempts(s.call, 2)).ok).toBe(true);
    expect(s.count()).toBe(2);
  });
  it("timeout then valid", async () => {
    const s = scripted([timeout, good]);
    expect((await runAttempts(s.call, 2)).ok).toBe(true);
  });
  it("reject then valid", async () => {
    const s = scripted(["throw", good]);
    expect((await runAttempts(s.call, 2)).ok).toBe(true);
  });
  it("invalid twice gives invalid_output", async () => {
    const s = scripted([bad, bad]);
    expect(await runAttempts(s.call, 2)).toEqual({ ok: false, lastKind: "invalid_output" });
    expect(s.count()).toBe(2);
  });
  it("returns the kind of the second failure", async () => {
    expect(await runAttempts(scripted([bad, timeout]).call, 2)).toEqual({ ok: false, lastKind: "timeout" });
    expect(await runAttempts(scripted([timeout, "throw"]).call, 2)).toEqual({ ok: false, lastKind: "unavailable" });
  });
  it("treats a plan rejected by isAcceptable as invalid_output", async () => {
    expect(await runAttempts(scripted([good]).call, 2, () => false)).toEqual({ ok: false, lastKind: "invalid_output" });
  });
  it("uses the same call for both attempts, with identical requests", async () => {
    const requests: string[] = [];
    const request = { user: "u" };
    let n = 0;
    const call = async (): Promise<LlmResult> => {
      requests.push(JSON.stringify(request));
      n += 1;
      return n === 1 ? { ok: true, text: "FAILED-OUTPUT" } : good;
    };
    await runAttempts(call, 2);
    expect(requests[0]).toBe(requests[1]);
    expect(requests[1]).not.toContain("FAILED-OUTPUT");
  });
});

describe("toFallbackReason", () => {
  it("maps every kind", () => {
    expect(toFallbackReason("timeout")).toBe("llm_timeout");
    expect(toFallbackReason("unavailable")).toBe("llm_unavailable");
    expect(toFallbackReason("invalid_output")).toBe("llm_invalid_output");
  });
});
