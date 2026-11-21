import { beforeEach, describe, expect, it, vi } from "vitest";
import { callLlm } from "./llm";
import { buildGeminiConfig, createGeminiClient } from "./llm-gemini";

const mocks = vi.hoisted(() => ({
  factoryRuns: 0,
  ctor: vi.fn(),
  generateContent: vi.fn(),
}));

vi.mock("@google/genai", () => {
  mocks.factoryRuns += 1;
  class GoogleGenAI {
    models = { generateContent: mocks.generateContent };
    constructor(options: unknown) {
      mocks.ctor(options);
    }
  }
  return { GoogleGenAI };
});

const FAKE_KEY = "AIza-FAKE-SECRET-KEY-123";
const request = { system: "SYSTEM TEXT", user: "USER TEXT", maxOutputTokens: 1500, temperature: 0.4 };

beforeEach(() => {
  mocks.ctor.mockClear();
  mocks.generateContent.mockReset();
});

describe("buildGeminiConfig", () => {
  it("has exactly the five allowed keys and no tools-like key", () => {
    const signal = new AbortController().signal;
    const config = buildGeminiConfig({ ...request, signal });
    expect(Object.keys(config).sort()).toEqual(
      ["abortSignal", "maxOutputTokens", "responseMimeType", "systemInstruction", "temperature"].sort(),
    );
    expect(config).toEqual({
      systemInstruction: "SYSTEM TEXT",
      maxOutputTokens: 1500,
      temperature: 0.4,
      abortSignal: signal,
      responseMimeType: "application/json",
    });
    for (const key of ["tools", "toolConfig", "functionDeclarations", "thinkingConfig"]) {
      expect(config).not.toHaveProperty(key);
    }
  });
});

describe("createGeminiClient", () => {
  it("imports the SDK lazily on the first generate only", async () => {
    mocks.generateContent.mockResolvedValue({ text: "{}" });
    const runsBefore = mocks.factoryRuns;
    const client = createGeminiClient({ apiKey: FAKE_KEY, model: "m" });
    expect(mocks.ctor).not.toHaveBeenCalled();
    const signal = new AbortController().signal;
    await client.generate({ ...request, signal });
    await client.generate({ ...request, signal });
    expect(mocks.factoryRuns - runsBefore).toBeLessThanOrEqual(1);
    expect(mocks.ctor).toHaveBeenCalledTimes(1);
  });

  it("passes the key and attempts 1 to the constructor", async () => {
    mocks.generateContent.mockResolvedValue({ text: "ok" });
    const client = createGeminiClient({ apiKey: FAKE_KEY, model: "m" });
    await client.generate({ ...request, signal: new AbortController().signal });
    expect(mocks.ctor).toHaveBeenCalledWith({
      apiKey: FAKE_KEY,
      httpOptions: { retryOptions: { attempts: 1 } },
    });
  });

  it("sends the model, user text as contents and system text only in systemInstruction", async () => {
    mocks.generateContent.mockResolvedValue({ text: "answer" });
    const client = createGeminiClient({ apiKey: FAKE_KEY, model: "test-model" });
    const result = await client.generate({ ...request, signal: new AbortController().signal });
    expect(result).toEqual({ text: "answer" });
    const params = mocks.generateContent.mock.calls[0]?.[0];
    expect(params.model).toBe("test-model");
    expect(params.contents).toBe("USER TEXT");
    expect(params.config.systemInstruction).toBe("SYSTEM TEXT");
    expect(JSON.stringify(params.contents)).not.toContain("SYSTEM TEXT");
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });

  it("returns an empty string when the SDK has no text", async () => {
    mocks.generateContent.mockResolvedValue({ text: undefined });
    const client = createGeminiClient({ apiKey: FAKE_KEY, model: "m" });
    const result = await client.generate({ ...request, signal: new AbortController().signal });
    expect(result).toEqual({ text: "" });
  });

  it("does not leak the key when the SDK rejects, through callLlm", async () => {
    mocks.generateContent.mockRejectedValue(new Error(`bad request key=${FAKE_KEY}`));
    const client = createGeminiClient({ apiKey: FAKE_KEY, model: "m" });
    const result = await callLlm(client, request, 1000);
    expect(result).toEqual({ ok: false, kind: "unavailable" });
    expect(JSON.stringify(result)).not.toContain(FAKE_KEY);
  });
});
