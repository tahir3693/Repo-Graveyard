import { afterEach, describe, expect, it, vi } from "vitest";
import { callLlm, type LlmClient, type LlmGenerateArgs, type LlmRequest } from "./llm";

const request: LlmRequest = { system: "sys", user: "usr", maxOutputTokens: 100, temperature: 0.2 };

function clientReturning(value: unknown): LlmClient {
  return { generate: () => Promise.resolve(value as { text: string }) };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("callLlm", () => {
  it("returns the text on success", async () => {
    const result = await callLlm(clientReturning({ text: "hello" }), request, 1000);
    expect(result).toEqual({ ok: true, text: "hello" });
  });

  it("passes exactly five fields to the client and no tools-like key", async () => {
    let received: LlmGenerateArgs | null = null;
    const client: LlmClient = {
      generate: (args) => {
        received = args;
        return Promise.resolve({ text: "ok" });
      },
    };
    await callLlm(client, request, 1000);
    expect(received).not.toBeNull();
    const keys = Object.keys(received ?? {}).sort();
    expect(keys).toEqual(["maxOutputTokens", "signal", "system", "temperature", "user"]);
    expect(keys.some((k) => /tool/i.test(k) || /function/i.test(k))).toBe(false);
    expect(Object.keys(request)).toHaveLength(4);
  });

  it("times out when the client never resolves and ignores the signal", async () => {
    vi.useFakeTimers();
    const client: LlmClient = { generate: () => new Promise(() => {}) };
    const pending = callLlm(client, request, 5000);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toEqual({ ok: false, kind: "timeout" });
  });

  it("maps a rejection to unavailable without leaking the error", async () => {
    const client: LlmClient = {
      generate: () => Promise.reject(new Error("bad key AIzaFAKE-secret-123")),
    };
    const result = await callLlm(client, request, 1000);
    expect(result).toEqual({ ok: false, kind: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("AIzaFAKE-secret-123");
  });

  it("maps a synchronous throw to unavailable", async () => {
    const client: LlmClient = {
      generate: () => {
        throw new Error("AIzaFAKE-secret-123");
      },
    };
    const result = await callLlm(client, request, 1000);
    expect(result).toEqual({ ok: false, kind: "unavailable" });
  });

  it("maps blank text to invalid_output", async () => {
    const result = await callLlm(clientReturning({ text: "  \n\t " }), request, 1000);
    expect(result).toEqual({ ok: false, kind: "invalid_output" });
  });

  it("maps non-string text to invalid_output", async () => {
    for (const text of [42, null, undefined, { a: 1 }]) {
      const result = await callLlm(clientReturning({ text }), request, 1000);
      expect(result).toEqual({ ok: false, kind: "invalid_output" });
    }
  });
});
