import { NextRequest } from "next/server";

import { readUserToken } from "@/lib/auth/token";
import type { EnvRecord } from "@/lib/env";
import { createOctokitRequester, readGitHubApiBaseUrl } from "@/lib/github/requester";
import type { LlmClient } from "@/lib/llm";
import { createGeminiClient } from "@/lib/llm-gemini";

import { readResurrectionConfig } from "./config";
import type { ResurrectDeps } from "./handle-resurrect";
import { getResurrectionState } from "./state";

// Adapts a standard Request to the NextRequest that next-auth's getToken expects (same as the scan route).
function readSessionToken(req: Request): ReturnType<ResurrectDeps["readUserToken"]> {
  return readUserToken(new NextRequest(req));
}

/** Server only. The LLM key and model come from the env the route passes in; the key is never logged. */
export function createResurrectionDeps(env: EnvRecord): ResurrectDeps {
  const config = readResurrectionConfig(env);
  const apiKey = config.llmApiKey;
  // The handler still reads the key for redaction, but JSON.stringify and spreads skip it.
  Object.defineProperty(config, "llmApiKey", { value: apiKey, enumerable: false });
  const makeLlmClient = (): LlmClient | null =>
    apiKey === null ? null : createGeminiClient({ apiKey, model: config.llmModel });

  // Design hook: the fake-mode swap of makeRequester and makeLlmClient (task 9.1) would go here.
  const deps: ResurrectDeps = {
    now: () => new Date(),
    env: {},
    config,
    makeRequester: (token) => createOctokitRequester(token, readGitHubApiBaseUrl(env)),
    readUserToken: readSessionToken,
    makeLlmClient,
    state: getResurrectionState(),
    newRequestId: () => crypto.randomUUID(),
    // Only the error code and request id are ever logged.
    log: ({ code, requestId }) => {
      console.warn({ code, requestId });
    },
  };
  // env holds the LLM key, so keep it out of JSON.stringify and spreads.
  Object.defineProperty(deps, "env", { value: env, enumerable: false });
  return deps;
}
