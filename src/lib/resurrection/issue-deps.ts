import { readUserTokenFromRequest } from "@/lib/auth/token";
import type { EnvRecord } from "@/lib/env";
import { createIssueWriter } from "@/lib/github/issue-writer";
import { createOctokitRequester, readGitHubApiBaseUrl } from "@/lib/github/requester";

import { readResurrectionConfig } from "./config";
import type { IssueDeps } from "./handle-issue";
import { getResurrectionState } from "./state";


/** Server only. Never creates an LLM client; the config's LLM key is dropped. */
export function createIssueDeps(env: EnvRecord): IssueDeps {
  const config = readResurrectionConfig(env);
  // The issue route has no use for the LLM key, so hide it from serialization.
  Object.defineProperty(config, "llmApiKey", { value: null, enumerable: false });
  return {
    now: () => new Date(),
    config,
    makeRequester: (token) => createOctokitRequester(token, readGitHubApiBaseUrl(env)),
    makeIssueWriter: (token) => createIssueWriter(token, readGitHubApiBaseUrl(env)),
    readUserToken: (req) => readUserTokenFromRequest(req, env),
    state: getResurrectionState(),
    newRequestId: () => crypto.randomUUID(),
    // Only the error code and request id are ever logged.
    log: ({ code, requestId }) => {
      console.warn({ code, requestId });
    },
  };
}
