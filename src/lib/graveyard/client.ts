/**
 * Browser-side calls to the app's own API routes. Never calls GitHub or an LLM directly.
 * Every response is validated with Zod before use (tech.md, Validation).
 *
 * The schemas mirror the server ones in the auth-ingestion and resurrection specs.
 * The ESLint client guard forbids importing `@/lib/github/*` here, so the repo schema is
 * repeated. Drift is caught by `tsc`: `buildGraveEntries` passes these repos to
 * `scoreRepo(repo: RepoHealth)`.
 */
import { z } from "zod";
import type { RevivalPlanData } from "@/lib/graveyard/resurrect-state";
import { IssueSuccessSchema } from "@/lib/resurrection/response";

const ScannedRepoSchema = z.strictObject({
  name: z.string().min(1),
  url: z.url(),
  description: z.string().nullable(),
  lastCommitAt: z.iso.datetime({ offset: true }).nullable(),
  openIssues: z.number().int().nonnegative(),
  archived: z.boolean(),
  ciStatus: z.enum(["passing", "failing", "none"]),
  hasReadme: z.boolean(),
  outdatedDeps: z.boolean().nullable(),
  stars: z.number().int().nonnegative(),
  language: z.string().nullable(),
});

export const ScanSuccessSchema = z.object({
  mode: z.enum(["user", "demo"]),
  repos: z.array(ScannedRepoSchema),
  skippedForks: z.number().int().nonnegative(),
  skippedInvalid: z.number().int().nonnegative(),
  truncated: z.boolean(),
  code: z.enum(["empty_account", "rate_limited"]).optional(),
  stale: z.boolean().optional(),
  cachedAt: z.iso.datetime().optional(),
  resetAt: z.iso.datetime().optional(),
  sampleData: z.boolean().optional(),
});

export type ScanSuccess = z.infer<typeof ScanSuccessSchema>;
export type ScannedRepo = ScanSuccess["repos"][number];

/** Plan length caps from the resurrection requirements (PLAN_*_MAX). */
const PLAN_LIMITS = { diagnosis: 600, step: 300, title: 100, body: 4000 } as const;

const codePoints = (s: string) => [...s].length;

const boundedText = (max: number) =>
  z
    .string()
    .refine((s) => s.trim().length > 0, "must not be blank")
    .refine((s) => codePoints(s) <= max, "too long");

export const EFFORTS = ["under 1 hour", "a weekend", "a week or more"] as const;

export const RevivalPlanSchema = z.object({
  diagnosis: boundedText(PLAN_LIMITS.diagnosis),
  smallestNextStep: boundedText(PLAN_LIMITS.step),
  effort: z.enum(EFFORTS),
  issueTitle: boundedText(PLAN_LIMITS.title).refine((s) => !/[\r\n]/.test(s), "one line"),
  issueBody: boundedText(PLAN_LIMITS.body),
});

export const ResurrectResponseSchema = z.object({
  plan: RevivalPlanSchema,
  source: z.enum(["ai", "fallback"]),
  fallbackReason: z.string().optional(),
});

/** Same rule as the server's RepoNameSchema: a bare repo name, never "owner/repo". */
const RepoNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9._-]{1,100}$/)
  .refine((s) => s !== "." && s !== "..");

/** A safe, generic failure. Never carries response text, tokens or repo data. */
export class GraveyardRequestError extends Error {
  readonly kind: "network" | "http" | "invalid";
  /** The typed error code from the app's own API, when the response had one. */
  readonly code: string | null;

  constructor(kind: "network" | "http" | "invalid", code: string | null = null) {
    super(`Graveyard request failed: ${kind}`);
    this.name = "GraveyardRequestError";
    this.kind = kind;
    this.code = code;
  }
}

/** Only the code of an API error body. Message and other fields are never read. */
const ApiErrorBodySchema = z.object({
  error: z.object({ code: z.string().regex(/^[a-z_]{1,40}$/) }),
});

async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const parsed = ApiErrorBodySchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error.code : null;
  } catch {
    return null;
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

async function postJson(
  path: string,
  body: Record<string, unknown>,
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new GraveyardRequestError("network");
  }
  if (!response.ok) throw new GraveyardRequestError("http", await readErrorCode(response));
  try {
    return await response.json();
  } catch {
    throw new GraveyardRequestError("invalid");
  }
}

/** POST /api/scan. Forks are always excluded on this page. */
export async function scanRepos(
  options: { demo: boolean; signal?: AbortSignal },
  fetchImpl: FetchLike = defaultFetch,
): Promise<ScanSuccess> {
  const json = await postJson(
    "/api/scan",
    { demo: options.demo, includeForks: false },
    fetchImpl,
    options.signal,
  );
  const parsed = ScanSuccessSchema.safeParse(json);
  if (!parsed.success) throw new GraveyardRequestError("invalid");
  return parsed.data;
}

/**
 * POST /api/resurrect with only the repo name. The server resolves the owner from the
 * session or the demo account, so an owner is never sent from the browser.
 */
export async function resurrectRepo(
  repo: string,
  options: { demo: boolean; sample?: boolean },
  fetchImpl: FetchLike = defaultFetch,
): Promise<RevivalPlanData> {
  const name = RepoNameSchema.safeParse(repo);
  if (!name.success) throw new GraveyardRequestError("invalid");
  // Sample repos send the flag and the name only: never an owner, never repo content.
  const body =
    options.sample === true
      ? { repo: name.data, sample: true }
      : options.demo
        ? { repo: name.data, demo: true }
        : { repo: name.data };
  const json = await postJson("/api/resurrect", body, fetchImpl);
  const parsed = ResurrectResponseSchema.safeParse(json);
  if (!parsed.success) throw new GraveyardRequestError("invalid");
  return parsed.data.source === "fallback" ? { ...parsed.data.plan, fallback: true } : parsed.data.plan;
}

/**
 * Error codes the issue route can return. Repeated here (not imported from
 * `@/lib/resurrection/errors`) so the browser bundle does not pull in server modules.
 * A unit test keeps this list equal to the server's `ERROR_CODES`.
 */
export const ISSUE_ERROR_CODES = [
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
] as const;
export type IssueErrorCode = (typeof ISSUE_ERROR_CODES)[number] | "generic";
const IssueErrorBodySchema = z.object({
  error: z.object({
    code: z.enum(ISSUE_ERROR_CODES),
    retryAfterSeconds: z.number().int().min(1).optional(),
  }),
});
export type FileIssueResult =
  | { ok: true; issueUrl: string; number: number }
  | { ok: false; code: IssueErrorCode; retryAfterSeconds?: number };
const GENERIC_FAILURE: FileIssueResult = { ok: false, code: "generic" };
/**
 * POST /api/issue with only `repo`, `title` and `body`. The server resolves the owner from
 * the session. Returns a safe result: on failure only a known error code, never response
 * text. Never throws and never logs.
 */
export async function fileIssue(
  repo: string,
  issue: { title: string; body: string },
  fetchImpl: FetchLike = defaultFetch,
): Promise<FileIssueResult> {
  let response: Response;
  try {
    response = await fetchImpl("/api/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo, title: issue.title, body: issue.body }),
    });
  } catch {
    return GENERIC_FAILURE;
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return GENERIC_FAILURE;
  }
  if (response.status === 201) {
    const parsed = IssueSuccessSchema.safeParse(json);
    return parsed.success
      ? { ok: true, issueUrl: parsed.data.issueUrl, number: parsed.data.number }
      : GENERIC_FAILURE;
  }
  const failure = IssueErrorBodySchema.safeParse(json);
  if (!failure.success) return GENERIC_FAILURE;
  const { code, retryAfterSeconds } = failure.data.error;
  return retryAfterSeconds === undefined
    ? { ok: false, code }
    : { ok: false, code, retryAfterSeconds };
}