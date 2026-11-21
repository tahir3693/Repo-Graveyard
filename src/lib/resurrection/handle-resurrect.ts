import { appendClearCookies, sessionCookieNames } from "@/lib/auth/session-cookies";
import { readDemoConfig, type EnvRecord } from "@/lib/env";
import type { GitHubRequester } from "@/lib/github/requester";
import type { LlmClient } from "@/lib/llm";

import type { ResurrectionConfig } from "./config";
import { mapGitHubFailure, toSafeError, type RouteFailure } from "./errors";
import { RESURRECTION_LIMITS } from "./limits";
import { readOnly } from "./read-only";
import {
  isAllowedOrigin,
  isJsonContentType,
  readBodyLimited,
  ResurrectRequestSchema,
  type ResurrectRequest,
} from "./request";
import { ResurrectSuccessSchema } from "./response";
import { resurrect } from "./service";
import type { ResurrectionState } from "./state";

export type ResurrectDeps = {
  now: () => Date;
  env: EnvRecord;
  config: ResurrectionConfig;
  makeRequester: (token: string | null) => GitHubRequester;
  readUserToken: (req: Request) => Promise<{ login: string; accessToken: string } | null>;
  makeLlmClient: () => LlmClient | null;
  state: ResurrectionState;
  newRequestId: () => string;
  log: (entry: { code: string; requestId: string }) => void;
};

type Actor = { mode: "user" | "demo"; owner: string; token: string | null; inFlightKey: string };

type Fail = RouteFailure & { retryAfterSeconds?: number };

type Ctx = {
  deps: ResurrectDeps;
  req: Request;
  requestId: string;
  now: Date;
  mode: "user" | "demo";
};

function failResponse(ctx: Ctx, fail: Fail): Response {
  ctx.deps.log({ code: fail.code, requestId: ctx.requestId });
  const response = toSafeError(fail.code, {
    ...(fail.resetAt === undefined ? {} : { resetAt: fail.resetAt }),
    ...(fail.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: fail.retryAfterSeconds }),
  });
  if (fail.clearSession) {
    appendClearCookies(response.headers, sessionCookieNames(readCookieNames(ctx.req)));
  }
  return response;
}

function readCookieNames(req: Request): string[] {
  const header = req.headers.get("cookie");
  if (header === null) return [];
  return header
    .split(";")
    .map((part) => part.split("=")[0]?.trim() ?? "")
    .filter((name) => name !== "");
}

function checkOrigin(ctx: Ctx): boolean {
  const own = new URL(ctx.req.url).origin;
  return isAllowedOrigin(ctx.req.headers.get("origin"), [own, ...ctx.deps.config.appOrigins]);
}

/** Content type, size cap, JSON and schema. Null means any failure; the input is never echoed. */
async function readRequest(req: Request): Promise<ResurrectRequest | null> {
  if (!isJsonContentType(req.headers.get("content-type"))) return null;
  const body = await readBodyLimited(req.body, RESURRECTION_LIMITS.REQUEST_BODY_MAX_BYTES);
  if (!body.ok) return null;
  let json: unknown;
  try {
    json = JSON.parse(body.text);
  } catch {
    return null;
  }
  const parsed = ResurrectRequestSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

async function resolveActor(
  ctx: Ctx,
  body: ResurrectRequest,
): Promise<{ actor: Actor } | { fail: Fail }> {
  if (body.demo === true) {
    const demo = readDemoConfig(ctx.deps.env);
    if (demo === null) return { fail: { code: "demo_unavailable" } };
    return {
      actor: {
        mode: "demo",
        owner: demo.username,
        token: demo.token,
        inFlightKey: `demo:${body.repo.toLowerCase()}`,
      },
    };
  }
  const user = await ctx.deps.readUserToken(ctx.req);
  if (user === null) return { fail: { code: "unauthenticated" } };
  return {
    actor: {
      mode: "user",
      owner: user.login,
      token: user.accessToken,
      inFlightKey: user.login.toLowerCase(),
    },
  };
}

function checkRate(ctx: Ctx, actor: Actor): Fail | null {
  const { state } = ctx.deps;
  const decision =
    actor.mode === "demo"
      ? state.demo.check("demo", ctx.now.getTime())
      : state.resurrect.check(actor.inFlightKey, ctx.now.getTime());
  if (decision.allowed) return null;
  return { code: "resurrect_rate_limited", retryAfterSeconds: decision.retryAfterSeconds };
}

function knownSecrets(ctx: Ctx, actor: Actor): string[] {
  const values = [ctx.deps.config.llmApiKey, actor.token];
  return values.filter((value): value is string => value !== null && value !== "");
}

async function runResurrect(ctx: Ctx, actor: Actor, body: ResurrectRequest): Promise<Response> {
  const { deps } = ctx;
  const outcome = await resurrect(
    {
      request: readOnly(deps.makeRequester(actor.token)),
      makeLlmClient: deps.makeLlmClient,
      config: deps.config,
      secrets: knownSecrets(ctx, actor),
    },
    { owner: actor.owner, repo: body.repo, now: ctx.now },
  );
  const parsed = ResurrectSuccessSchema.safeParse(outcome);
  if (!parsed.success) return failResponse(ctx, { code: "internal_error" });
  return Response.json(parsed.data, { status: 200 });
}

async function runWithActor(ctx: Ctx, actor: Actor, body: ResurrectRequest): Promise<Response> {
  const { inFlight } = ctx.deps.state;
  if (!inFlight.acquire(actor.inFlightKey)) return failResponse(ctx, { code: "resurrect_busy" });
  try {
    const limited = checkRate(ctx, actor);
    if (limited !== null) return failResponse(ctx, limited);
    return await runResurrect(ctx, actor, body);
  } finally {
    inFlight.release(actor.inFlightKey);
  }
}

async function process(ctx: Ctx): Promise<Response> {
  if (!checkOrigin(ctx)) return failResponse(ctx, { code: "bad_origin" });
  const body = await readRequest(ctx.req);
  if (body === null) return failResponse(ctx, { code: "invalid_request" });
  if (body.demo === true) ctx.mode = "demo";
  const resolved = await resolveActor(ctx, body);
  if ("fail" in resolved) return failResponse(ctx, resolved.fail);
  return runWithActor(ctx, resolved.actor, body);
}

/** Handles one resurrect request. Every failure is a fixed-table Safe_Error; the log gets only code and request id. */
export async function handleResurrect(deps: ResurrectDeps, req: Request): Promise<Response> {
  const ctx: Ctx = { deps, req, requestId: deps.newRequestId(), now: deps.now(), mode: "user" };
  try {
    return await process(ctx);
  } catch (error) {
    return failResponse(ctx, mapGitHubFailure(error, { now: ctx.now, mode: ctx.mode, phase: "read" }));
  }
}
