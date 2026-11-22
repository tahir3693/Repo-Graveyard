/**
 * Every fixed value of the resurrection feature. No imports, so client code may use it.
 * Character caps count Unicode code points, not UTF-16 units.
 */
export const RESURRECTION_LIMITS = {
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
} as const;

export type WindowConfig = { limit: number; windowMs: number };

export const RESURRECT_LIMIT: WindowConfig = { limit: 10, windowMs: 600_000 };
export const DEMO_RESURRECT_LIMIT: WindowConfig = { limit: 20, windowMs: 600_000 };
export const ISSUE_LIMIT: WindowConfig = { limit: 5, windowMs: 600_000 };

export const DEFAULT_LLM_MODEL = "gemini-3.5-flash-lite";
export const FALLBACK_NAME_MAX = 60;
