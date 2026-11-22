import { appendClearCookies, sessionCookieNames } from "../auth/session-cookies";
import { readAuthEnv, readDemoConfig, type EnvRecord } from "../env";
import { ScanFailureError, type ScanFailure } from "../github/errors";
import type { GitHubRequester } from "../github/requester";
import { getSampleRepos } from "../demo/sample-repos";
import { scanAccount, type ScanAccount, type ScanData } from "../github/scan";
import { DEMO_CACHE_TTL_MS, USER_CACHE_TTL_MS, type ScanCache } from "./cache";
import { parseScanRequest, type ScanRequest } from "./request";
import {
  buildSafeError,
  ERROR_TABLE,
  ScanSuccessSchema,
  type ErrorCode,
  type ScanSuccess,
} from "./response";

export type ScanDeps = {
  now: () => Date;
  env: EnvRecord;
  cache: ScanCache;
  makeRequester: (token: string | null) => GitHubRequester;
  readUserToken: (req: Request) => Promise<{ login: string; accessToken: string } | null>;
  log: (entry: { code: string; requestId: string }) => void;
};

const DEMO_CACHE_KEY = "demo";

type Mode = ScanSuccess["mode"];

type Fail = { code: ErrorCode; resetAt?: string; clearSession?: boolean };

function failWith(deps: ScanDeps, requestId: string, req: Request, fail: Fail): Response {
  deps.log({ code: fail.code, requestId });
  const body = buildSafeError(fail.code, fail.resetAt === undefined ? {} : { resetAt: fail.resetAt });
  const headers = new Headers();
  if (fail.clearSession) {
    appendClearCookies(headers, sessionCookieNames(readCookieNames(req)));
  }
  return Response.json(body, { status: ERROR_TABLE[fail.code].status, headers });
}

function readCookieNames(req: Request): string[] {
  const header = req.headers.get("cookie");
  if (!header) return [];
  return header
    .split(";")
    .map((part) => part.split("=")[0]?.trim() ?? "")
    .filter((name) => name !== "");
}

async function readBody(req: Request): Promise<ScanRequest | null> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return null;
  }
  if (text.trim() === "") return parseScanRequest({});
  try {
    return parseScanRequest(JSON.parse(text));
  } catch {
    return null;
  }
}

function successResponse(
  mode: Mode,
  data: ScanData,
  extra: Pick<ScanSuccess, "stale" | "cachedAt" | "resetAt" | "code"> = {},
): Response | null {
  const code = extra.code ?? (data.repos.length === 0 && data.skippedInvalid === 0 ? "empty_account" : undefined);
  const candidate = {
    mode,
    repos: data.repos,
    skippedForks: data.skippedForks,
    skippedInvalid: data.skippedInvalid,
    truncated: data.truncated,
    ...(code === undefined ? {} : { code }),
    ...(extra.stale === undefined ? {} : { stale: extra.stale }),
    ...(extra.cachedAt === undefined ? {} : { cachedAt: extra.cachedAt }),
    ...(extra.resetAt === undefined ? {} : { resetAt: extra.resetAt }),
  };
  const parsed = ScanSuccessSchema.safeParse(candidate);
  return parsed.success ? Response.json(parsed.data, { status: 200 }) : null;
}

function mapFailure(failure: ScanFailure, mode: Mode): Fail {
  switch (failure.kind) {
    case "rate_limited":
      return failure.resetAt === undefined
        ? { code: "rate_limited" }
        : { code: "rate_limited", resetAt: failure.resetAt };
    case "token_revoked":
      // A rejected demo token is a server configuration problem, not the visitor's session.
      return mode === "user" ? { code: "token_revoked", clearSession: true } : { code: "demo_unavailable" };
    case "forbidden":
      return { code: "forbidden" };
    case "not_found":
      return { code: "account_not_found" };
    case "unavailable":
      return { code: "github_unavailable" };
    case "invalid_response":
      return { code: "invalid_github_response" };
    default:
      return { code: "internal_error" };
  }
}

type ScanContext = {
  deps: ScanDeps;
  requestId: string;
  req: Request;
  body: ScanRequest;
};

/**
 * Demo mode never fails because of GitHub or missing config: it serves the bundled sample
 * repos instead. The sample data holds no token and the response carries `sampleData: true`.
 * Only the reason code and request id are logged.
 */
function sampleResponse(ctx: ScanContext, reason: string): Response {
  const { deps, requestId, req } = ctx;
  deps.log({ code: reason, requestId });
  const candidate = {
    mode: "demo" as const,
    repos: getSampleRepos(deps.now()),
    skippedForks: 0,
    skippedInvalid: 0,
    truncated: false,
    sampleData: true,
  };
  const parsed = ScanSuccessSchema.safeParse(candidate);
  return parsed.success
    ? Response.json(parsed.data, { status: 200 })
    : failWith(deps, requestId, req, { code: "internal_error" });
}

async function runDemo(ctx: ScanContext): Promise<Response> {
  const { deps, requestId, req, body } = ctx;
  const config = readDemoConfig(deps.env);
  if (config === null) return sampleResponse(ctx, "demo_sample_no_username");

  const nowMs = deps.now().getTime();
  const hit = deps.cache.get(DEMO_CACHE_KEY, nowMs, DEMO_CACHE_TTL_MS, body.includeForks);
  if (hit !== null) {
    const cached = successResponse("demo", hit.data);
    if (cached !== null) return cached;
    return failWith(deps, requestId, req, { code: "internal_error" });
  }

  const account: ScanAccount = { kind: "demo", username: config.username };
  let data: ScanData;
  try {
    data = await scanAccount(
      { request: deps.makeRequester(config.token), now: deps.now() },
      account,
      body.includeForks,
    );
  } catch (error) {
    if (error instanceof ScanFailureError) {
      return sampleResponse(ctx, `demo_sample_${error.failure.kind}`);
    }
    throw error;
  }
  deps.cache.set(DEMO_CACHE_KEY, data, body.includeForks, deps.now().getTime());
  const response = successResponse("demo", data);
  return response ?? failWith(deps, requestId, req, { code: "internal_error" });
}

function staleFallback(ctx: ScanContext, login: string, failure: ScanFailure): Response | null {
  if (failure.kind !== "rate_limited") return null;
  const { deps, body } = ctx;
  const hit = deps.cache.get(userCacheKey(login), deps.now().getTime(), USER_CACHE_TTL_MS, body.includeForks);
  if (hit === null) return null;
  return successResponse("user", hit.data, {
    code: "rate_limited",
    stale: true,
    cachedAt: new Date(hit.storedAt).toISOString(),
    ...(failure.resetAt === undefined ? {} : { resetAt: failure.resetAt }),
  });
}

function userCacheKey(login: string): string {
  return `user:${login.toLowerCase()}`;
}

async function runUser(ctx: ScanContext): Promise<Response> {
  const { deps, requestId, req, body } = ctx;
  if (readAuthEnv(deps.env) === null) {
    return failWith(deps, requestId, req, { code: "auth_not_configured" });
  }
  const user = await deps.readUserToken(req);
  if (user === null) return failWith(deps, requestId, req, { code: "unauthorized" });

  try {
    const data = await scanAccount(
      { request: deps.makeRequester(user.accessToken), now: deps.now() },
      { kind: "user" },
      body.includeForks,
    );
    deps.cache.set(userCacheKey(user.login), data, body.includeForks, deps.now().getTime());
    const response = successResponse("user", data);
    return response ?? failWith(deps, requestId, req, { code: "internal_error" });
  } catch (error) {
    if (error instanceof ScanFailureError) {
      const stale = staleFallback(ctx, user.login, error.failure);
      if (stale !== null) return stale;
    }
    throw error;
  }
}

/** Handles one scan request. Every failure is a fixed-table Safe_Error and logs only code and request id. */
export async function handleScan(deps: ScanDeps, req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  let mode: Mode = "user";
  try {
    const body = await readBody(req);
    if (body === null) return failWith(deps, requestId, req, { code: "validation_error" });
    mode = body.demo ? "demo" : "user";
    const ctx: ScanContext = { deps, requestId, req, body };
    return body.demo ? await runDemo(ctx) : await runUser(ctx);
  } catch (error) {
    const fail: Fail =
      error instanceof ScanFailureError ? mapFailure(error.failure, mode) : { code: "internal_error" };
    return failWith(deps, requestId, req, fail);
  }
}
