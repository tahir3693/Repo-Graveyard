import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/llm-gemini", () => ({ createGeminiClient: vi.fn(() => ({ generate: vi.fn() })) }));
vi.mock("@/lib/github/requester", () => ({
  createOctokitRequester: vi.fn(() => vi.fn()),
  readGitHubApiBaseUrl: vi.fn(() => null),
}));
vi.mock("@/lib/auth/token", () => ({
  readUserToken: vi.fn(async () => null),
  readUserTokenFromRequest: vi.fn(async () => null),
}));

import { createGeminiClient } from "@/lib/llm-gemini";

import { createResurrectionDeps } from "./deps";
import { DEFAULT_LLM_MODEL } from "./limits";

const KEY = "sk-test-secret-key-123";

describe("createResurrectionDeps", () => {
  beforeEach(() => {
    vi.mocked(createGeminiClient).mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns no LLM client when LLM_API_KEY is missing", () => {
    expect(createResurrectionDeps({}).makeLlmClient()).toBeNull();
    expect(createGeminiClient).not.toHaveBeenCalled();
  });

  it("returns no LLM client when LLM_API_KEY is blank", () => {
    expect(createResurrectionDeps({ LLM_API_KEY: "   " }).makeLlmClient()).toBeNull();
    expect(createGeminiClient).not.toHaveBeenCalled();
  });

  it("creates the Gemini client with the key and validated model", () => {
    const deps = createResurrectionDeps({ LLM_API_KEY: KEY, LLM_MODEL: "gemini-custom.1" });
    expect(deps.makeLlmClient()).not.toBeNull();
    expect(createGeminiClient).toHaveBeenCalledWith({ apiKey: KEY, model: "gemini-custom.1" });
  });

  it("falls back to the default model when LLM_MODEL is invalid", () => {
    createResurrectionDeps({ LLM_API_KEY: KEY, LLM_MODEL: "bad model!" }).makeLlmClient();
    expect(createGeminiClient).toHaveBeenCalledWith({ apiKey: KEY, model: DEFAULT_LLM_MODEL });
  });

  it("logs only code and requestId and never the key", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const deps = createResurrectionDeps({ LLM_API_KEY: KEY });
    const entry = { code: "internal_error", requestId: "r1", apiKey: KEY, extra: 1 };
    deps.log(entry);
    expect(warn).toHaveBeenCalledWith({ code: "internal_error", requestId: "r1" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(KEY);
  });

  it("does not contain the key when serialized", () => {
    const deps = createResurrectionDeps({ LLM_API_KEY: KEY });
    expect(JSON.stringify(deps.config)).not.toContain(KEY);
    expect(JSON.stringify(deps)).not.toContain(KEY);
  });
});
