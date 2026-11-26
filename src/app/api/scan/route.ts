import { readUserTokenFromRequest } from "@/lib/auth/token";
import { createOctokitRequester, readGitHubApiBaseUrl } from "@/lib/github/requester";
import { getScanCache } from "@/lib/scan/cache";
import { toLogLine } from "@/lib/scan/diagnostics";
import { handleScan, type ScanDeps } from "@/lib/scan/handler";


// Built per request so environment variables are read at request time, server only.
function buildDeps(): ScanDeps {
  return {
    now: () => new Date(),
    env: process.env,
    cache: getScanCache(),
    makeRequester: (token) => createOctokitRequester(token, readGitHubApiBaseUrl(process.env)),
    readUserToken: (req) => readUserTokenFromRequest(req, process.env),
    // Only a fixed set of short, redacted strings is ever logged (see scan/diagnostics.ts).
    log: (entry) => {
      console.warn(toLogLine(entry));
    },
  };
}

export function POST(request: Request): Promise<Response> {
  return handleScan(buildDeps(), request);
}
