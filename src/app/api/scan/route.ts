import { NextRequest } from "next/server";
import { readUserToken } from "@/lib/auth/token";
import { createOctokitRequester, readGitHubApiBaseUrl } from "@/lib/github/requester";
import { getScanCache } from "@/lib/scan/cache";
import { handleScan, type ScanDeps } from "@/lib/scan/handler";

// Adapts a standard Request to the NextRequest that next-auth's getToken expects.
function readSessionToken(req: Request): ReturnType<ScanDeps["readUserToken"]> {
  return readUserToken(new NextRequest(req));
}

// Built per request so environment variables are read at request time, server only.
function buildDeps(): ScanDeps {
  return {
    now: () => new Date(),
    env: process.env,
    cache: getScanCache(),
    makeRequester: (token) => createOctokitRequester(token, readGitHubApiBaseUrl(process.env)),
    readUserToken: readSessionToken,
    // Only the error code and request id are ever logged.
    log: ({ code, requestId }) => {
      console.warn({ code, requestId });
    },
  };
}

export function POST(request: Request): Promise<Response> {
  return handleScan(buildDeps(), request);
}
