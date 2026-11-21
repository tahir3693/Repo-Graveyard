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

export const USER_REPOS_ROUTE = "GET /user/repos";
export const DEMO_REPOS_ROUTE = "GET /users/{username}/repos";

export type ScanAccount = { kind: "user" } | { kind: "demo"; username: string };

export type ScanData = {
  repos: RepoHealth[];
  skippedForks: number;
  skippedInvalid: number;
  truncated: boolean;
};

type ScanDeps = { request: GitHubRequester; now: Date };

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

/** Lists, validates and enriches an account's repositories. Any failure rejects with no partial data. */
export async function scanAccount(
  deps: ScanDeps,
  account: ScanAccount,
  includeForks: boolean,
): Promise<ScanData> {
  const { items, truncated } = await collectPages(fetchListPage(deps, account), REPO_LIMIT);
  const split = splitValidEntries(items);
  if (!split.ok) throw new ScanFailureError({ kind: "invalid_response" });

  const { kept, skippedForks } = filterForks(split.repos, includeForks);
  const healths = await mapWithConcurrency(kept, DETAIL_CONCURRENCY, async (repo) => {
    const details = await fetchRepoDetails(deps.request, repo, deps.now);
    return checkHealth(toRepoHealth(repo, details));
  });

  return {
    repos: sortByName(healths),
    skippedForks,
    skippedInvalid: split.skippedInvalid,
    truncated,
  };
}
