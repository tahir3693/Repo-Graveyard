import { describe, expect, it } from "vitest";
import {
  DEFAULT_LLM_MODEL,
  DEMO_RESURRECT_LIMIT,
  FALLBACK_NAME_MAX,
  ISSUE_LIMIT,
  RESURRECT_LIMIT,
  RESURRECTION_LIMITS,
} from "./limits";

describe("RESURRECTION_LIMITS", () => {
  it("holds the values of the requirements Constants table", () => {
    expect(RESURRECTION_LIMITS).toEqual({
      GITHUB_TIMEOUT_MS: 10_000,
      CONTEXT_DEADLINE_MS: 10_000,
      LLM_TIMEOUT_MS: 7_500,
      LLM_MAX_ATTEMPTS: 2,
      CLIENT_TIMEOUT_MS: 30_000,
      ISSUE_CLIENT_TIMEOUT_MS: 15_000,
      LLM_MAX_OUTPUT_TOKENS: 1_500,
      LLM_TEMPERATURE: 0.3,
      LLM_RAW_MAX_CHARS: 20_000,
      CAP_NAME: 100,
      CAP_DESCRIPTION: 300,
      CAP_LANGUAGE: 50,
      CAP_README: 6_000,
      CAP_TREE_ENTRIES: 50,
      CAP_TREE_ENTRY: 80,
      CAP_COMMITS: 10,
      CAP_COMMIT: 200,
      CAP_FAILING_CHECKS: 5,
      CAP_CHECK_NAME: 80,
      CAP_ISSUE_TITLES: 10,
      CAP_ISSUE_TITLE: 150,
      CAP_SERIALIZED: 32_000,
      PLAN_DIAGNOSIS_MAX: 600,
      PLAN_STEP_MAX: 300,
      PLAN_TITLE_MAX: 100,
      PLAN_BODY_MAX: 4_000,
      ISSUE_BODY_MAX_REQUEST: 4_000,
      REQUEST_BODY_MAX_BYTES: 20_000,
      MAX_TRACKED_KEYS: 1_000,
      FOG_REVEAL_MS: 800,
    });
  });

  it("keeps the server budget at 25 seconds", () => {
    const { CONTEXT_DEADLINE_MS, LLM_MAX_ATTEMPTS, LLM_TIMEOUT_MS } = RESURRECTION_LIMITS;
    expect(CONTEXT_DEADLINE_MS + LLM_MAX_ATTEMPTS * LLM_TIMEOUT_MS).toBe(25_000);
  });

  it("exports the three rate-limit windows and the model default", () => {
    expect(RESURRECT_LIMIT).toEqual({ limit: 10, windowMs: 600_000 });
    expect(DEMO_RESURRECT_LIMIT).toEqual({ limit: 20, windowMs: 600_000 });
    expect(ISSUE_LIMIT).toEqual({ limit: 5, windowMs: 600_000 });
    expect(DEFAULT_LLM_MODEL).toBe("gemini-3.5-flash-lite");
    expect(FALLBACK_NAME_MAX).toBe(60);
  });
});
