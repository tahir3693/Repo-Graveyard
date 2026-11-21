import { appendClearCookies, sessionCookieNames } from "@/lib/auth/session-cookies";
import type { IssueWriter } from "@/lib/github/issue-writer";
import type { GitHubRequester } from "@/lib/github/requester";

import type { ResurrectionConfig } from "./config";
import { mapGitHubFailure, toSafeError, type RouteFailure } from "./errors";
import { RepoWithIssuesSchema } from "./github-schemas";
import { createIssue, prepareIssue } from "./issue";
import { RESURRECTION_LIMITS } from "./limits";
import { readOnly } from "./read-only";
import {
  IssueRequestSchema,
  isAllowedOrigin,
  isJsonContentType,
  readBodyLimited,
  type IssueRequest,
} from "./request";
import { IssueSuccessSchema } from "./response";
import type { ResurrectionState } from "./state";

export type IssueDeps = {
  now: () => Date;
  config: ResurrectionConfig;
  makeRequester: (token: string | null) => GitHubRequester;
  makeIssueWriter: (token: string) => IssueWriter;
  readUserToken: (req: Request) => Promise<{ login: string; accessToken: string } | null>;
  state: ResurrectionState;
  newRequestId: () => string;
  log: (entry: { code: string; requestId: string }) => void;
};

type Fail = RouteFailure & { retryAfterSeconds?: number };

type Ctx = { deps: IssueDeps; req: Request; requestId: string; now: Date };

function readCookieNames(req: Request): string[] {
  const header = req.headers.get("cookie");
  if (header === null) return [];
  return header
    .split(";")
    .map((part) => part.split("=")[0]?.trim() ?? "")
    .filter((name) => name !== "");
}

function failResponse(ctx: Ctx, fail: Fail): Response {
  ctx.deps.log({ code: fail.code, requestId: ctx.requestId });
  const response = toSafeError(fail.code, {
    ...(fail.resetAt === undefined ? {} : { resetAt: fail.resetAt }),
    ...(fail.retryAfterSeconds === undefined ? {} : { retryAfterSeconds: fail.retryAfterSeconds }),
    ...(fail.message === undefined ? {} : { message: fail.message }),
  });
  if (fail.clearSession) {
    appendClearCookies(response.headers, sessionCookieNames(readCookieNames(ctx.req)));
  }
  return response;
}

function checkOrigin(ctx: Ctx): boolean {
  const own = new URL(ctx.req.url).origin;
  return isAllowedOrigin(ctx.req.headers.get("origin"), [own, ...ctx.deps.config.appOrigins]);
}

/** Content type, size cap, JSON and schema. Null means any failure; the input is never echoed. */
async function readRequest(req: Request): Promise<IssueRequest | null> {
  if (!isJsonContentType(req.headers.get("content-type"))) return null;
  const body = await readBodyLimited(req.body, RESURRECTION_LIMITS.REQUEST_BODY_MAX_BYTES);
  if (!body.ok) return null;
  let json: unknown;
  try {
    json = JSON.parse(body.text);
  } catch {
    return null;
  }
  const parsed = IssueRequestSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

type Checked = { ok: true } | { ok: false; fail: Fail };

async function checkRepo(
  ctx: Ctx,
  user: { login: string; accessToken: string },
  repo: string,
): Promise<Checked> {
  const request = readOnly(ctx.deps.makeRequester(user.accessToken));
  let data: unknown;
  try {
    data = (await request("GET /repos/{owner}/{repo}", { owner: user.login, repo })).data;
  } catch (error) {
    return { ok: false, fail: mapGitHubFailure(error, { now: ctx.now, mode: "user", phase: "read" }) };
  }
  const parsed = RepoWithIssuesSchema.safeParse(data);
  if (!parsed.success) return { ok: false, fail: { code: "invalid_github_response" } };
  const meta = parsed.data;
  if (meta.owner.login.toLowerCase() !== user.login.toLowerCase()) {
    return { ok: false, fail: { code: "not_repo_owner" } };
  }
  if (meta.archived) return { ok: false, fail: { code: "repo_archived" } };
  if (!meta.has_issues) return { ok: false, fail: { code: "issues_disabled" } };
  return { ok: true };
}

async function process(ctx: Ctx): Promise<Response> {
  const { deps } = ctx;
  if (!checkOrigin(ctx)) return failResponse(ctx, { code: "bad_origin" });
  const body = await readRequest(ctx.req);
  if (body === null) return failResponse(ctx, { code: "invalid_request" });
  const prepared = prepareIssue(body.title, body.body);
  if (!prepared.ok) return failResponse(ctx, { code: "invalid_request" });
  if (body.demo === true) return failResponse(ctx, { code: "demo_mode" });

  const user = await deps.readUserToken(ctx.req);
  if (user === null) return failResponse(ctx, { code: "unauthenticated" });

  const decision = deps.state.issue.check(user.login.toLowerCase(), ctx.now.getTime());
  if (!decision.allowed) {
    return failResponse(ctx, {
      code: "issue_rate_limited",
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }

  const checked = await checkRepo(ctx, user, body.repo);
  if (!checked.ok) return failResponse(ctx, checked.fail);

  const created = await createIssue(deps.makeIssueWriter(user.accessToken), {
    login: user.login,
    repo: body.repo,
    title: prepared.title,
    body: prepared.body,
    now: ctx.now,
  });
  if (!created.ok) return failResponse(ctx, created.failure);

  const success = IssueSuccessSchema.safeParse({ issueUrl: created.issueUrl, number: created.number });
  if (!success.success) return failResponse(ctx, { code: "issue_result_unknown" });
  return Response.json(success.data, { status: 201 });
}

/** Handles one issue request. Every failure is a fixed-table Safe_Error; the log gets only code and request id. */
export async function handleIssue(deps: IssueDeps, req: Request): Promise<Response> {
  const ctx: Ctx = { deps, req, requestId: deps.newRequestId(), now: deps.now() };
  try {
    return await process(ctx);
  } catch {
    return failResponse(ctx, { code: "internal_error" });
  }
}
