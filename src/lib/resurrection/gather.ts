import { z } from "zod";

import { mapWithConcurrency } from "@/lib/github/concurrency";
import { lookupOutdatedDeps } from "@/lib/github/details";
import { classifyGitHubFailure, ScanFailureError } from "@/lib/github/errors";
import type { GitHubRequester, GitHubResponse } from "@/lib/github/requester";
import { GitHubRepoSchema, type GitHubRepo } from "@/lib/github/schemas";

import type { RawContext } from "./context";
import {
  CheckRunsListSchema,
  OpenIssuesSchema,
  RawReadmeSchema,
  RecentCommitsSchema,
  TreeSchema,
} from "./github-schemas";
import { RESURRECTION_LIMITS } from "./limits";
import { isReadRoute, type ReadRequester, type ReadRoute } from "./read-only";

const CONCURRENCY = 5;

const StatusSchema = z.object({ status: z.number() });

function readStatus(error: unknown): number | undefined {
  const parsed = StatusSchema.safeParse(error);
  return parsed.success ? parsed.data.status : undefined;
}

type ReadOutcome = { ok: true; response: GitHubResponse } | { ok: false; status: number | undefined };

/**
 * One read. Token-revoked and rate-limit failures are fatal and rethrown as
 * `ScanFailureError`. Any other failure comes back as `{ ok: false, status }`.
 */
async function read(
  request: ReadRequester,
  route: ReadRoute,
  params: Record<string, unknown>,
  now: Date,
): Promise<ReadOutcome> {
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

function isFatal(error: unknown): boolean {
  return (
    error instanceof ScanFailureError &&
    (error.failure.kind === "token_revoked" || error.failure.kind === "rate_limited")
  );
}

async function readMetadata(
  request: ReadRequester,
  owner: string,
  repo: string,
  now: Date,
): Promise<GitHubRepo> {
  let response: GitHubResponse;
  try {
    response = await request("GET /repos/{owner}/{repo}", { owner, repo });
  } catch (error) {
    throw new ScanFailureError(classifyGitHubFailure(error, now));
  }
  const parsed = GitHubRepoSchema.safeParse(response.data);
  if (!parsed.success) throw new ScanFailureError({ kind: "invalid_response" });
  return parsed.data;
}

async function readReadme(request: ReadRequester, owner: string, repo: string, now: Date): Promise<string | null> {
  const result = await read(
    request,
    "GET /repos/{owner}/{repo}/readme",
    { owner, repo, mediaType: { format: "raw" } },
    now,
  );
  if (!result.ok) return result.status === 404 ? "" : null;
  const parsed = RawReadmeSchema.safeParse(result.response.data);
  return parsed.success ? parsed.data : null;
}

async function readTree(
  request: ReadRequester,
  meta: GitHubRepo,
  now: Date,
): Promise<RawContext["tree"]> {
  const result = await read(
    request,
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
    { owner: meta.owner.login, repo: meta.name, tree_sha: meta.default_branch },
    now,
  );
  if (!result.ok) return result.status === 404 || result.status === 409 ? [] : null;
  const parsed = TreeSchema.safeParse(result.response.data);
  return parsed.success ? parsed.data.tree.map((e) => ({ path: e.path, type: e.type })) : null;
}

async function readCommits(
  request: ReadRequester,
  meta: GitHubRepo,
  now: Date,
): Promise<RawContext["commits"]> {
  const result = await read(
    request,
    "GET /repos/{owner}/{repo}/commits",
    { owner: meta.owner.login, repo: meta.name, per_page: RESURRECTION_LIMITS.CAP_COMMITS },
    now,
  );
  if (!result.ok) return result.status === 409 ? [] : null;
  const parsed = RecentCommitsSchema.safeParse(result.response.data);
  if (!parsed.success) return null;
  return parsed.data.map((c) => ({ message: c.commit.message, date: c.commit.committer?.date ?? null }));
}

async function readChecks(
  request: ReadRequester,
  meta: GitHubRepo,
  now: Date,
): Promise<RawContext["checks"]> {
  const result = await read(
    request,
    "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
    { owner: meta.owner.login, repo: meta.name, ref: meta.default_branch, per_page: 100 },
    now,
  );
  if (!result.ok) return result.status === 404 ? [] : null;
  const parsed = CheckRunsListSchema.safeParse(result.response.data);
  return parsed.success ? parsed.data.check_runs.map((c) => ({ name: c.name, conclusion: c.conclusion })) : null;
}

async function readIssues(
  request: ReadRequester,
  meta: GitHubRepo,
  now: Date,
): Promise<RawContext["issues"]> {
  const result = await read(
    request,
    "GET /repos/{owner}/{repo}/issues",
    { owner: meta.owner.login, repo: meta.name, state: "open", per_page: 30 },
    now,
  );
  if (!result.ok) return null;
  const parsed = OpenIssuesSchema.safeParse(result.response.data);
  if (!parsed.success) return null;
  return parsed.data.filter((i) => i.pull_request === undefined).map((i) => ({ title: i.title }));
}

/**
 * Task 1.3 mismatch: the design expected a function returning the committer
 * date of the latest commit touching `package.json`. The export in
 * `src/lib/github/details.ts` is `lookupOutdatedDeps(request, repo, now)`,
 * which returns `boolean | null` (it already applies `deriveOutdatedDeps`
 * with `now`; `null` means no manifest date or a non-fatal failure). We use it
 * as is and keep the boolean in `RawContext.outdatedDeps`, so the date is
 * never derived twice. The adapter forwards GET routes only; its GitHub
 * reads still go through the injected read-only requester.
 */
async function readOutdatedDeps(request: ReadRequester, meta: GitHubRepo, now: Date): Promise<boolean | null> {
  const requester: GitHubRequester = (route, params) => {
    if (!isReadRoute(route)) throw new Error("read-only requester");
    return request(route, params);
  };
  return lookupOutdatedDeps(requester, meta, now);
}

/**
 * Reads metadata, then six GET reads with at most 5 in flight. Fatal failures
 * (401, rate limit, metadata errors) throw `ScanFailureError`. Every other
 * failure, or a read still running at `CONTEXT_DEADLINE_MS`, gives `null` for
 * that field.
 */
export async function gatherContext(
  deps: { request: ReadRequester; now: Date },
  owner: string,
  repo: string,
): Promise<RawContext> {
  const { request, now } = deps;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), RESURRECTION_LIMITS.CONTEXT_DEADLINE_MS);
  });

  try {
    const meta = await Promise.race([readMetadata(request, owner, repo, now), deadline]);
    if (meta === null) throw new ScanFailureError({ kind: "unavailable" });

    const out: Omit<RawContext, "repo"> = {
      readme: null,
      tree: null,
      commits: null,
      checks: null,
      issues: null,
      outdatedDeps: null,
    };

    async function guarded<T>(fn: () => Promise<T | null>): Promise<T | null> {
      try {
        return await Promise.race([fn(), deadline]);
      } catch (error) {
        if (isFatal(error)) throw error;
        return null;
      }
    }

    const tasks: Array<() => Promise<void>> = [
      async () => {
        out.readme = await guarded(() => readReadme(request, meta.owner.login, meta.name, now));
      },
      async () => {
        out.tree = await guarded(() => readTree(request, meta, now));
      },
      async () => {
        out.commits = await guarded(() => readCommits(request, meta, now));
      },
      async () => {
        out.checks = await guarded(() => readChecks(request, meta, now));
      },
      async () => {
        out.issues = await guarded(() => readIssues(request, meta, now));
      },
      async () => {
        out.outdatedDeps = await guarded(() => readOutdatedDeps(request, meta, now));
      },
    ];
    await mapWithConcurrency(tasks, CONCURRENCY, (task) => task());

    return { repo: meta, ...out };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
