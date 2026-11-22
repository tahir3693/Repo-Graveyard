import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callLlm, type LlmClient, type LlmRequest } from "@/lib/llm";
import { runAttempts, toFallbackReason } from "./attempts";
import { readResurrectionConfig } from "./config";
import { DEFAULT_LLM_MODEL, RESURRECTION_LIMITS } from "./limits";

const REQUEST: LlmRequest = { system: "s", user: "u", maxOutputTokens: 10, temperature: 0 };
const { CONTEXT_DEADLINE_MS, LLM_MAX_ATTEMPTS, LLM_TIMEOUT_MS } = RESURRECTION_LIMITS;
const TOTAL_BUDGET_MS = CONTEXT_DEADLINE_MS + LLM_MAX_ATTEMPTS * LLM_TIMEOUT_MS;

class StatusError extends Error {
  constructor(readonly status: number) {
    super("provider said no, key AIzaFAKE-secret-0001");
  }
}

function failingClient(status: number, delayMs: number) {
  const generate = vi.fn(
    () =>
      new Promise<{ text: string }>((_resolve, reject) => {
        setTimeout(() => reject(new StatusError(status)), delayMs);
      }),
  );
  const client: LlmClient = { generate };
  return { client, generate };
}

function hangingClient() {
  const generate = vi.fn(() => new Promise<{ text: string }>(() => undefined));
  const client: LlmClient = { generate };
  return { client, generate };
}

function attempt(client: LlmClient) {
  return runAttempts(() => callLlm(client, REQUEST, LLM_TIMEOUT_MS), LLM_MAX_ATTEMPTS);
}

describe("LLM failure path", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uses the new default model when LLM_MODEL is unset or empty", () => {
    expect(DEFAULT_LLM_MODEL).toBe("gemini-3.5-flash-lite");
    expect(readResurrectionConfig({}).llmModel).toBe("gemini-3.5-flash-lite");
    expect(readResurrectionConfig({ LLM_MODEL: "" }).llmModel).toBe("gemini-3.5-flash-lite");
  });

  it("keeps two attempts plus the context deadline within about 25 seconds", () => {
    expect(TOTAL_BUDGET_MS).toBeLessThanOrEqual(25_000);
  });

  it.each([401, 403, 404])("does not retry a %i", async (status) => {
    const { client, generate } = failingClient(status, 100);
    const pending = attempt(client);
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await pending;
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, lastKind: "unavailable" });
  });

  it.each([429, 503])("retries a %i once, then returns the failure within the budget", async (status) => {
    const { client, generate } = failingClient(status, 2_000);
    const pending = attempt(client);
    await vi.advanceTimersByTimeAsync(TOTAL_BUDGET_MS);
    const result = await pending;
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: false, lastKind: "unavailable" });
    if (!result.ok) expect(toFallbackReason(result.lastKind)).toBe("llm_unavailable");
  });

  it("retries a timeout once and finishes within the LLM budget", async () => {
    const { client, generate } = hangingClient();
    const pending = attempt(client);
    await vi.advanceTimersByTimeAsync(LLM_MAX_ATTEMPTS * LLM_TIMEOUT_MS);
    const result = await pending;
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: false, lastKind: "timeout" });
  });

  it("never exposes the provider message in the result", async () => {
    const { client } = failingClient(404, 0);
    const pending = attempt(client);
    await vi.advanceTimersByTimeAsync(10);
    expect(JSON.stringify(await pending)).not.toContain("AIzaFAKE");
  });
});
