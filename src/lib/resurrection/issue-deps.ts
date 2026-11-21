import { NextRequest } from "next/server";

import { readUserToken } from "@/lib/auth/token";
import type { EnvRecord } from "@/lib/env";
import { createIssueWriter } from "@/lib/github/issue-writer";
import { createOctokitRequester, readGitHubApiBaseUrl } from "@/lib/github/requester";

import { readResurrectionConfig } from "./config";
import type { IssueDeps } from "./handle-issue";
import { getResurrectionState } from "./state";

// Adapts a standard Request to the NextRequest that next-auth's getToken expects (same as the other routes).
function readSessionToken(req: Request): ReturnType<IssueDeps["readUserToken"]> {
  return readUserToken(new NextRequest(req));
}

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
    readUserToken: readSessionToken,
    state: getResurrectionState(),
    newRequestId: () => crypto.randomUUID(),
    // Only the error code and request id are ever logged.
    log: ({ code, requestId }) => {
      console.warn({ code, requestId });
    },
  };
}
