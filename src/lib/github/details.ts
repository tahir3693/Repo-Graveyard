import { z } from "zod";
import { deriveCiStatus, deriveOutdatedDeps, type CiStatus } from "./derive";
import { classifyGitHubFailure, ScanFailureError } from "./errors";
import type { RepoDetails } from "./map";
import type { GitHubRequester, GitHubResponse } from "./requester";
import { CheckRunsSchema, CommitListSchema, ReadmeSchema, type GitHubRepo } from "./schemas";

export const LATEST_COMMIT_ROUTE = "GET /repos/{owner}/{repo}/commits";
export const CHECK_RUNS_ROUTE = "GET /repos/{owner}/{repo}/commits/{ref}/check-runs";
export const README_ROUTE = "GET /repos/{owner}/{repo}/readme";
export const MANIFEST_COMMIT_ROUTE = "GET /repos/{owner}/{repo}/commits";

export const DETAIL_ROUTES: readonly string[] = [
  LATEST_COMMIT_ROUTE,
  CHECK_RUNS_ROUTE,
  README_ROUTE,
  MANIFEST_COMMIT_ROUTE,
];

type CallResult = { ok: true; response: GitHubResponse } | { ok: false; status: number | undefined };

const StatusSchema = z.object({ status: z.number() });

function readStatus(error: unknown): number | undefined {
  const parsed = StatusSchema.safeParse(error);
  return parsed.success ? parsed.data.status : undefined;
}

/**
 * Runs one request. 401 and rate limits abort the scan; any other failure
 * is returned so the caller can fall back to a default.
 */
async function call(
  request: GitHubRequester,
  route: string,
  params: Record<string, unknown>,
  now: Date,
): Promise<CallResult> {
  try {
    return { ok: true, response: await request(route, params) };
  } catch (error) {
    const failure = classifyGitHubFailure(error, now);
    if (failure.kind === "token_revoked" || failure.kind === "rate_limited") {
      throw new ScanFailureError(failure);
    }
    return { ok: false, status: readStatus(error) };
  }
}

function invalidResponse(): ScanFailureError {
  return new ScanFailureError({ kind: "invalid_response" });
}

type LatestCommit = { kind: "empty" } | { kind: "date"; value: string };

async function lookupLatestCommit(
  request: GitHubRequester,
  repo: GitHubRepo,
  now: Date,
): Promise<LatestCommit> {
  const fallback: LatestCommit = repo.pushed_at === null ? { kind: "empty" } : { kind: "date", value: repo.pushed_at };
  const result = await call(
    request,
    LATEST_COMMIT_ROUTE,
    { owner: repo.owner.login, repo: repo.name, per_page: 1 },
    now,
  );
  if (!result.ok) return result.status === 409 ? { kind: "empty" } : fallback;
  const parsed = CommitListSchema.safeParse(result.response.data);
  if (!parsed.success) throw invalidResponse();
  const first = parsed.data[0];
  if (first === undefined) return { kind: "empty" };
  const date = first.commit.committer?.date;
  return date === undefined ? fallback : { kind: "date", value: date };
}

async function lookupCiStatus(request: GitHubRequester, repo: GitHubRepo, now: Date): Promise<CiStatus> {
  const result = await call(
    request,
    CHECK_RUNS_ROUTE,
    { owner: repo.owner.login, repo: repo.name, ref: repo.default_branch, per_page: 100 },
    now,
  );
  if (!result.ok) return "none";
  const parsed = CheckRunsSchema.safeParse(result.response.data);
  if (!parsed.success) throw invalidResponse();
  return deriveCiStatus(parsed.data.check_runs.map((run) => run.conclusion));
}

async function lookupReadme(request: GitHubRequester, repo: GitHubRepo, now: Date): Promise<boolean> {
  const result = await call(request, README_ROUTE, { owner: repo.owner.login, repo: repo.name }, now);
  if (!result.ok) return false;
  const parsed = ReadmeSchema.safeParse(result.response.data);
  if (!parsed.success) throw invalidResponse();
  return true;
}

async function lookupOutdatedDeps(
  request: GitHubRequester,
  repo: GitHubRepo,
  now: Date,
): Promise<boolean | null> {
  const result = await call(
    request,
    MANIFEST_COMMIT_ROUTE,
    { owner: repo.owner.login, repo: repo.name, path: "package.json", per_page: 1 },
    now,
  );
  if (!result.ok) return null;
  const parsed = CommitListSchema.safeParse(result.response.data);
  if (!parsed.success) throw invalidResponse();
  const date = parsed.data[0]?.commit.committer?.date ?? null;
  return deriveOutdatedDeps(date, now);
}

/** Runs the four lookups in sequence for one repository. `now` is injected. */
export async function fetchRepoDetails(
  request: GitHubRequester,
  repo: GitHubRepo,
  now: Date,
): Promise<RepoDetails> {
  const latest = await lookupLatestCommit(request, repo, now);
  if (latest.kind === "empty") {
    return { lastCommitAt: null, ciStatus: "none", hasReadme: false, outdatedDeps: null };
  }
  const ciStatus = await lookupCiStatus(request, repo, now);
  const hasReadme = await lookupReadme(request, repo, now);
  const outdatedDeps = await lookupOutdatedDeps(request, repo, now);
  return { lastCommitAt: latest.value, ciStatus, hasReadme, outdatedDeps };
}
