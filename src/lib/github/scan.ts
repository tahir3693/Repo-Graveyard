import { z } from "zod";
import { mapWithConcurrency, DETAIL_CONCURRENCY } from "./concurrency";
import { fetchRepoDetails } from "./details";
import { classifyGitHubFailure, ScanFailureError } from "./errors";
import { filterForks } from "./forks";
import { toRepoHealth } from "./map";
import { collectPages, PAGE_SIZE, parseHasNextPage, REPO_LIMIT, type RepoPage } from "./pagination";
import { RepoHealthSchema, type RepoHealth } from "./repo-health";
import type { GitHubRequester } from "./requester";
import { sortByName } from "./sort";
import { splitValidEntries } from "./validate-list";
import type { GitHubRepo } from "./schemas";

export const USER_REPOS_ROUTE = "GET /user/repos";
export const DEMO_REPOS_ROUTE = "GET /users/{username}/repos";

export type ScanAccount = { kind: "user" } | { kind: "demo"; username: string };

export type ScanData = {
  repos: RepoHealth[];
  skippedForks: number;
  /** Repos that could not be read: an invalid list entry, or a repo whose own data was unreadable. */
  skippedInvalid: number;
  truncated: boolean;
};

type ScanDeps = {
  request: GitHubRequester;
  now: Date;
  /** Called when a stage starts, so a caller can say where an unexpected exception happened. */
  onStep?: (step: "list-repos" | "fetch-details") => void;
  /** Called once for each repo that was skipped, with the reason. Never throws into the scan. */
  onSkip?: (error: unknown) => void;
};

/** One list page: an array whose entries are validated one by one later. */
const RepoListPageSchema = z.array(z.unknown());

function listRequest(account: ScanAccount, page: number): { route: string; params: Record<string, unknown> } {
  const common = { per_page: PAGE_SIZE, page, sort: "full_name", direction: "asc" };
  if (account.kind === "user") {
    return { route: USER_REPOS_ROUTE, params: { ...common, affiliation: "owner" } };
  }
  return { route: DEMO_REPOS_ROUTE, params: { ...common, username: account.username, type: "owner" } };
}

function fetchListPage(deps: ScanDeps, account: ScanAccount) {
  return async (page: number): Promise<RepoPage> => {
    const { route, params } = listRequest(account, page);
    let response;
    try {
      response = await deps.request(route, params);
    } catch (error) {
      if (error instanceof ScanFailureError) throw error;
      throw new ScanFailureError(classifyGitHubFailure(error, deps.now));
    }
    // The page shape is checked with Zod here; each entry is parsed with
    // GitHubRepoSchema in splitValidEntries before any field is read.
    const listed = RepoListPageSchema.safeParse(response.data);
    if (!listed.success) {
      throw new ScanFailureError({ kind: "invalid_response" });
    }
    return { items: listed.data, hasNext: parseHasNextPage(response.headers.link) };
  };
}

function checkHealth(candidate: RepoHealth): RepoHealth {
  const parsed = RepoHealthSchema.safeParse(candidate);
  if (!parsed.success) throw new ScanFailureError({ kind: "invalid_response" });
  return parsed.data;
}

/** A revoked token or a rate limit affects the whole account, so it must stop the scan. */
function isFatal(error: unknown): boolean {
  return (
    error instanceof ScanFailureError &&
    (error.failure.kind === "token_revoked" || error.failure.kind === "rate_limited")
  );
}

/**
 * Reads one repo's details. Fatal failures are rethrown. Anything else is about this repo
 * only (an unreadable payload, unexpected data), so the repo is skipped and reported.
 */
async function readOneRepo(deps: ScanDeps, repo: GitHubRepo): Promise<RepoHealth | null> {
  try {
    const details = await fetchRepoDetails(deps.request, repo, deps.now);
    return checkHealth(toRepoHealth(repo, details));
  } catch (error) {
    if (isFatal(error)) throw error;
    deps.onSkip?.(error);
    return null;
  }
}

/**
 * Lists, validates and enriches an account's repositories. A fatal failure (rate limit, revoked
 * token, a failing list page) rejects with no partial data. One repo with unreadable data is
 * skipped and counted in `skippedInvalid`. If every repo is unreadable, the scan fails, because
 * that points at the response and not at one repo.
 */
export async function scanAccount(
  deps: ScanDeps,
  account: ScanAccount,
  includeForks: boolean,
): Promise<ScanData> {
  deps.onStep?.("list-repos");
  const { items, truncated } = await collectPages(fetchListPage(deps, account), REPO_LIMIT);
  const split = splitValidEntries(items);
  if (!split.ok) throw new ScanFailureError({ kind: "invalid_response" });

  const { kept, skippedForks } = filterForks(split.repos, includeForks);
  deps.onStep?.("fetch-details");
  const results = await mapWithConcurrency(kept, DETAIL_CONCURRENCY, (repo) => readOneRepo(deps, repo));
  const healths = results.filter((health): health is RepoHealth => health !== null);
  if (kept.length > 0 && healths.length === 0) {
    throw new ScanFailureError({ kind: "invalid_response" });
  }

  return {
    repos: sortByName(healths),
    skippedForks,
    skippedInvalid: split.skippedInvalid + (results.length - healths.length),
    truncated,
  };
}
