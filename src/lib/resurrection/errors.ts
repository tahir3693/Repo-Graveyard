import { z } from "zod";
import { classifyGitHubFailure, ScanFailureError } from "@/lib/github/errors";
import { ERROR_TABLE } from "@/lib/scan/response";

export const RESURRECTION_ERROR_TABLE = {
  invalid_request: { status: 400, message: "The request was not valid." },
  bad_origin: { status: 403, message: "This request came from an unexpected place." },
  unauthenticated: { status: 401, message: "Sign in with GitHub to continue." },
  token_revoked: { status: 401, message: ERROR_TABLE.token_revoked.message },
  demo_mode: { status: 403, message: "Demo graveyards are look-only." },
  demo_unavailable: { status: 503, message: ERROR_TABLE.demo_unavailable.message },
  repo_not_found: { status: 404, message: "That repository was not found." },
  resurrect_busy: { status: 409, message: "A revival is already in progress." },
  resurrect_rate_limited: {
    status: 429,
    message: "Too many revival requests. Try again shortly.",
  },
  issue_rate_limited: { status: 429, message: "Too many issue requests. Try again shortly." },
  rate_limited: { status: 429, message: ERROR_TABLE.rate_limited.message },
  forbidden: { status: 403, message: ERROR_TABLE.forbidden.message },
  github_unavailable: { status: 502, message: ERROR_TABLE.github_unavailable.message },
  invalid_github_response: {
    status: 502,
    message: ERROR_TABLE.invalid_github_response.message,
  },
  not_repo_owner: { status: 403, message: "Only the repository owner can file issues." },
  repo_archived: { status: 409, message: "This repository is archived." },
  issues_disabled: { status: 409, message: "Issues are switched off for this repository." },
  issue_rejected: { status: 422, message: "GitHub did not accept this issue." },
  issue_result_unknown: {
    status: 502,
    message:
      "GitHub's answer could not be read. Check the repository's issue list before trying again.",
  },
  internal_error: { status: 500, message: ERROR_TABLE.internal_error.message },
} as const;

export type ErrorCode = keyof typeof RESURRECTION_ERROR_TABLE;

export const ISSUE_CREATE_UNAVAILABLE_MESSAGE =
  "GitHub did not answer. The issue may not have been created. Check the repository's issue list before trying again.";

export const ERROR_CODES = [
  "invalid_request",
  "bad_origin",
  "unauthenticated",
  "token_revoked",
  "demo_mode",
  "demo_unavailable",
  "repo_not_found",
  "resurrect_busy",
  "resurrect_rate_limited",
  "issue_rate_limited",
  "rate_limited",
  "forbidden",
  "github_unavailable",
  "invalid_github_response",
  "not_repo_owner",
  "repo_archived",
  "issues_disabled",
  "issue_rejected",
  "issue_result_unknown",
  "internal_error",
] as const satisfies readonly ErrorCode[];

export const ResurrectionErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string().max(140),
    resetAt: z.iso.datetime().optional(),
    retryAfterSeconds: z.number().int().min(1).optional(),
  }),
});

export type ResurrectionError = z.infer<typeof ResurrectionErrorSchema>;

export type SafeErrorExtra = {
  resetAt?: string;
  retryAfterSeconds?: number;
  message?: string;
};

const RATE_LIMIT_CODES: readonly ErrorCode[] = ["resurrect_rate_limited", "issue_rate_limited"];

/** Builds the fixed-table error response. A custom message is accepted only from the one constant. */
export function toSafeError(code: ErrorCode, extra: SafeErrorExtra = {}): Response {
  const entry = RESURRECTION_ERROR_TABLE[code];
  const message =
    extra.message === ISSUE_CREATE_UNAVAILABLE_MESSAGE ? extra.message : entry.message;
  const resetAt =
    extra.resetAt === undefined ? null : z.iso.datetime().safeParse(extra.resetAt);
  const retry =
    extra.retryAfterSeconds === undefined
      ? null
      : z.number().int().min(1).safeParse(extra.retryAfterSeconds);
  const headers = new Headers();
  if (retry?.success && RATE_LIMIT_CODES.includes(code)) {
    headers.set("Retry-After", String(retry.data));
  }
  return Response.json(
    {
      error: {
        code,
        message,
        ...(resetAt?.success ? { resetAt: resetAt.data } : {}),
        ...(retry?.success ? { retryAfterSeconds: retry.data } : {}),
      },
    },
    { status: entry.status, headers },
  );
}

export type RouteFailure = {
  code: ErrorCode;
  resetAt?: string;
  clearSession?: boolean;
  message?: string;
};

export type FailureContext = {
  now: Date;
  mode: "user" | "demo";
  phase: "read" | "issue-create";
};

export function mapGitHubFailure(error: unknown, ctx: FailureContext): RouteFailure {
  // A ScanFailureError already carries a classified failure; re-classifying it would lose the kind.
  const failure =
    error instanceof ScanFailureError ? error.failure : classifyGitHubFailure(error, ctx.now);
  const creating = ctx.phase === "issue-create";
  switch (failure.kind) {
    case "rate_limited":
      return failure.resetAt === undefined
        ? { code: "rate_limited" }
        : { code: "rate_limited", resetAt: failure.resetAt };
    case "token_revoked":
      return ctx.mode === "demo" && !creating
        ? { code: "demo_unavailable" }
        : { code: "token_revoked", clearSession: true };
    case "forbidden":
      return { code: "forbidden" };
    case "not_found":
      return { code: "repo_not_found" };
    case "unavailable":
      return creating
        ? { code: "github_unavailable", message: ISSUE_CREATE_UNAVAILABLE_MESSAGE }
        : { code: "github_unavailable" };
    case "invalid_response":
      return creating ? { code: "issue_result_unknown" } : { code: "invalid_github_response" };
    default:
      return { code: "internal_error" };
  }
}
