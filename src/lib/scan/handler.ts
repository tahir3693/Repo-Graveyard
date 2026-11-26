import { appendClearCookies, cookieNamesOf, sessionCookieNames } from "../auth/session-cookies";
import { readAuthEnv, readDemoConfig, type EnvRecord } from "../env";
import { ScanFailureError, type ScanFailure } from "../github/errors";
import type { GitHubRequester } from "../github/requester";
import { getSampleRepos } from "../demo/sample-repos";
import { scanAccount, type ScanAccount, type ScanData } from "../github/scan";
import { DEMO_CACHE_TTL_MS, USER_CACHE_TTL_MS, type ScanCache } from "./cache";
import {
  cutMessage,
  describeError,
  describeZodIssue,
  type Diagnostics,
  type LogEntry,
  type ScanStep,
} from "./diagnostics";
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
  /** Normally `{ code, requestId }`. Unexpected exceptions add a name, a step and a redacted message. */
  log: (entry: LogEntry) => void;
};

const DEMO_CACHE_KEY = "demo";

type Mode = ScanSuccess["mode"];

type Fail = { code: ErrorCode; resetAt?: string; clearSession?: boolean };

/** Mutable progress of one request, so the catch-all can say which stage was running. */
type ScanState = {
  step: ScanStep;
  /** Field path and issue code of the last response that failed validation. */
  invalid?: string;
  skipped: number;
  firstSkip?: unknown;
};

/**
 * What an unexpected exception means to the reader, by the stage it happened in. Each code
 * has copy in the UI. `internal_error` is left for the one stage that has no better answer.
 */
const UNEXPECTED_CODE: Record<ScanStep, ErrorCode> = {
  "read-body": "internal_error",
  "read-token": "unauthorized",
  "list-repos": "github_unavailable",
  "fetch-details": "github_unavailable",
  "build-response": "invalid_github_response",
};

function failWith(
  deps: ScanDeps,
  requestId: string,
  req: Request,
  fail: Fail,
  diagnostics?: Diagnostics,
): Response {
  deps.log(diagnostics === undefined ? { code: fail.code, requestId } : { code: fail.code, requestId, ...diagnostics });
  const body = buildSafeError(fail.code, fail.resetAt === undefined ? {} : { resetAt: fail.resetAt });
  const headers = new Headers();
  if (fail.clearSession) {
    appendClearCookies(headers, sessionCookieNames(cookieNamesOf(req.headers.get("cookie"))));
  }
  return Response.json(body, { status: ERROR_TABLE[fail.code].status, headers });
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

type ScanContext = {
  deps: ScanDeps;
  requestId: string;
  req: Request;
  body: ScanRequest;
  state: ScanState;
};

/**
 * The success body, or null when it does not fit `ScanSuccessSchema`. On null, `state.invalid`
 * says which field failed (a path and an issue code, never a value).
 */
function successResponse(
  state: ScanState,
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
  if (parsed.success) return Response.json(parsed.data, { status: 200 });
  state.invalid = describeZodIssue(parsed.error);
  return null;
}

/** A response that did not fit the schema: a typed code, with the failing field in the log. */
function failInvalidResponse(ctx: ScanContext): Response {
  const { deps, requestId, req, state } = ctx;
  return failWith(deps, requestId, req, { code: "invalid_github_response" }, {
    errorName: "ResponseValidation",
    step: "build-response",
    message: state.invalid ?? "",
  });
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

/** The hooks that let `scanAccount` report its stage and any repo it skipped. */
function scanHooks(ctx: ScanContext) {
  return {
    onStep: (step: "list-repos" | "fetch-details") => {
      ctx.state.step = step;
    },
    onSkip: (error: unknown) => {
      if (ctx.state.skipped === 0) ctx.state.firstSkip = error;
      ctx.state.skipped += 1;
    },
  };
}

/** One log line when repos were skipped, so a skipped repo is never invisible. */
function logSkipped(ctx: ScanContext): void {
  const { deps, requestId, state } = ctx;
  if (state.skipped === 0) return;
  const first = describeError(state.firstSkip, "fetch-details");
  deps.log({
    code: "repos_skipped",
    requestId,
    errorName: first.errorName,
    step: first.step,
    message: cutMessage(`${state.skipped} skipped. First: ${first.message}`),
  });
}

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
  const { deps, body, state } = ctx;
  const config = readDemoConfig(deps.env);
  if (config === null) return sampleResponse(ctx, "demo_sample_no_username");

  const nowMs = deps.now().getTime();
  const hit = deps.cache.get(DEMO_CACHE_KEY, nowMs, DEMO_CACHE_TTL_MS, body.includeForks);
  if (hit !== null) {
    state.step = "build-response";
    return successResponse(state, "demo", hit.data) ?? failInvalidResponse(ctx);
  }

  const account: ScanAccount = { kind: "demo", username: config.username };
  let data: ScanData;
  state.step = "list-repos";
  try {
    data = await scanAccount(
      { request: deps.makeRequester(config.token), now: deps.now(), ...scanHooks(ctx) },
      account,
      body.includeForks,
    );
  } catch (error) {
    if (error instanceof ScanFailureError) {
      return sampleResponse(ctx, `demo_sample_${error.failure.kind}`);
    }
    throw error;
  }
  state.step = "build-response";
  deps.cache.set(DEMO_CACHE_KEY, data, body.includeForks, deps.now().getTime());
  logSkipped(ctx);
  return successResponse(state, "demo", data) ?? failInvalidResponse(ctx);
}

function staleFallback(ctx: ScanContext, login: string, failure: ScanFailure): Response | null {
  if (failure.kind !== "rate_limited") return null;
  const { deps, body, state } = ctx;
  const hit = deps.cache.get(userCacheKey(login), deps.now().getTime(), USER_CACHE_TTL_MS, body.includeForks);
  if (hit === null) return null;
  return successResponse(state, "user", hit.data, {
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
  const { deps, requestId, req, body, state } = ctx;
  if (readAuthEnv(deps.env) === null) {
    return failWith(deps, requestId, req, { code: "auth_not_configured" });
  }
  // A throw here is caught by `handleScan` and answered as "not signed in", with diagnostics.
  state.step = "read-token";
  const user = await deps.readUserToken(req);
  if (user === null) return failWith(deps, requestId, req, { code: "unauthorized" });

  // The signed-in scan uses the same `scanAccount` and the same requester factory as demo mode.
  state.step = "list-repos";
  try {
    const data = await scanAccount(
      { request: deps.makeRequester(user.accessToken), now: deps.now(), ...scanHooks(ctx) },
      { kind: "user" },
      body.includeForks,
    );
    state.step = "build-response";
    deps.cache.set(userCacheKey(user.login), data, body.includeForks, deps.now().getTime());
    logSkipped(ctx);
    return successResponse(state, "user", data) ?? failInvalidResponse(ctx);
  } catch (error) {
    if (error instanceof ScanFailureError) {
      const stale = staleFallback(ctx, user.login, error.failure);
      if (stale !== null) return stale;
    }
    throw error;
  }
}

/**
 * Handles one scan request. A known failure is a fixed-table Safe_Error that logs only code and
 * request id. An unexpected exception is mapped by the stage it happened in to a typed code the
 * UI can explain, and logs the code, request id, error name, step and a redacted 120-character
 * message. The error object, stack, headers and response bodies are never logged.
 */
export async function handleScan(deps: ScanDeps, req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const state: ScanState = { step: "read-body", skipped: 0 };
  let mode: Mode = "user";
  try {
    const body = await readBody(req);
    if (body === null) return failWith(deps, requestId, req, { code: "validation_error" });
    mode = body.demo ? "demo" : "user";
    const ctx: ScanContext = { deps, requestId, req, body, state };
    return body.demo ? await runDemo(ctx) : await runUser(ctx);
  } catch (error) {
    if (error instanceof ScanFailureError) {
      return failWith(deps, requestId, req, mapFailure(error.failure, mode));
    }
    return failWith(
      deps,
      requestId,
      req,
      { code: UNEXPECTED_CODE[state.step] },
      describeError(error, state.step),
    );
  }
}
