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

  constructor(kind: "network" | "http" | "invalid") {
    super(`Graveyard request failed: ${kind}`);
    this.name = "GraveyardRequestError";
    this.kind = kind;
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
  if (!response.ok) throw new GraveyardRequestError("http");
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
  options: { demo: boolean },
  fetchImpl: FetchLike = defaultFetch,
): Promise<RevivalPlanData> {
  const name = RepoNameSchema.safeParse(repo);
  if (!name.success) throw new GraveyardRequestError("invalid");
  const body = options.demo ? { repo: name.data, demo: true } : { repo: name.data };
  const json = await postJson("/api/resurrect", body, fetchImpl);
  const parsed = ResurrectResponseSchema.safeParse(json);
  if (!parsed.success) throw new GraveyardRequestError("invalid");
  return parsed.data.plan;
}
