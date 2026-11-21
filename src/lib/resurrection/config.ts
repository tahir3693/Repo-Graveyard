import {
  DEFAULT_LLM_MODEL,
  DEMO_RESURRECT_LIMIT,
  RESURRECTION_LIMITS,
  type WindowConfig,
} from "./limits";

/** Server-only. Holds the LLM key, so never serialize it into a response or log. */
export type ResurrectionConfig = {
  llmApiKey: string | null;
  llmModel: string;
  llmTimeoutMs: number;
  demoLimit: WindowConfig;
  appOrigins: readonly string[];
};

type Env = Record<string, string | undefined>;

const MODEL_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function readKey(env: Env): string | null {
  const value = env.LLM_API_KEY;
  if (value === undefined || value.trim() === "") return null;
  return value.trim();
}

function readModel(env: Env): string {
  const value = env.LLM_MODEL;
  return value !== undefined && MODEL_PATTERN.test(value) ? value : DEFAULT_LLM_MODEL;
}

function readOrigins(env: Env): readonly string[] {
  const raw = env.NEXTAUTH_URL;
  if (raw === undefined) return [];
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return [];
    return [url.origin];
  } catch {
    return [];
  }
}

export function readResurrectionConfig(env: Env): ResurrectionConfig {
  // Design hook: E2E fake-config overrides (task 9.1) would be applied here.
  return {
    llmApiKey: readKey(env),
    llmModel: readModel(env),
    llmTimeoutMs: RESURRECTION_LIMITS.LLM_TIMEOUT_MS,
    demoLimit: DEMO_RESURRECT_LIMIT,
    appOrigins: readOrigins(env),
  };
}
