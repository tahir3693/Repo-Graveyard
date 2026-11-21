import { describe, expect, it } from "vitest";
import { readResurrectionConfig } from "./config";
import { DEFAULT_LLM_MODEL, DEMO_RESURRECT_LIMIT, RESURRECTION_LIMITS } from "./limits";

describe("readResurrectionConfig", () => {
  it("returns a null key when missing or blank", () => {
    expect(readResurrectionConfig({}).llmApiKey).toBeNull();
    expect(readResurrectionConfig({ LLM_API_KEY: "  \t " }).llmApiKey).toBeNull();
  });

  it("trims and returns a present key", () => {
    expect(readResurrectionConfig({ LLM_API_KEY: " k-123 " }).llmApiKey).toBe("k-123");
  });

  it("falls back to the default model for bad ids", () => {
    for (const bad of ["gemini/../x", "a".repeat(65), "", "has space"]) {
      expect(readResurrectionConfig({ LLM_MODEL: bad }).llmModel).toBe(DEFAULT_LLM_MODEL);
    }
    expect(readResurrectionConfig({}).llmModel).toBe(DEFAULT_LLM_MODEL);
  });

  it("uses a valid model id", () => {
    expect(readResurrectionConfig({ LLM_MODEL: "gemini-2.5-pro" }).llmModel).toBe("gemini-2.5-pro");
    expect(readResurrectionConfig({ LLM_MODEL: "a".repeat(64) }).llmModel).toBe("a".repeat(64));
  });

  it("uses production timeout and demo limit", () => {
    const config = readResurrectionConfig({ E2E_LLM_TIMEOUT_MS: "5", E2E_FAKES: "1" });
    expect(config.llmTimeoutMs).toBe(RESURRECTION_LIMITS.LLM_TIMEOUT_MS);
    expect(config.demoLimit).toEqual(DEMO_RESURRECT_LIMIT);
  });

  it("reduces NEXTAUTH_URL to its origin and ignores invalid values", () => {
    expect(readResurrectionConfig({ NEXTAUTH_URL: "https://app.example.com/a/b?x=1" }).appOrigins).toEqual([
      "https://app.example.com",
    ]);
    expect(readResurrectionConfig({ NEXTAUTH_URL: "not a url" }).appOrigins).toEqual([]);
    expect(readResurrectionConfig({ NEXTAUTH_URL: "javascript:alert(1)" }).appOrigins).toEqual([]);
    expect(readResurrectionConfig({}).appOrigins).toEqual([]);
  });

  it("keeps the key out of everything except the config object", () => {
    const secret = "sk-very-secret-value";
    const config = readResurrectionConfig({ LLM_API_KEY: secret, LLM_MODEL: "bad/model", NEXTAUTH_URL: "bad" });
    const rest = Object.fromEntries(Object.entries(config).filter(([name]) => name !== "llmApiKey"));
    expect(Object.keys(rest)).not.toContain("llmApiKey");
    expect(JSON.stringify(rest)).not.toContain(secret);
    expect(JSON.stringify({ model: config.llmModel, origins: config.appOrigins })).not.toContain(secret);
    expect(new Error(`bad config for ${config.llmModel}`).message).not.toContain(secret);
  });
});
