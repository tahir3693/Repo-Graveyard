import { describe, expect, it } from "vitest";
import {
  CHECK_RUNS_ROUTE,
  DETAIL_ROUTES,
  LATEST_COMMIT_ROUTE,
  README_ROUTE,
  fetchRepoDetails,
  lookupOutdatedDeps,
} from "./details";
import { ScanFailureError } from "./errors";
import type { GitHubRequester, GitHubResponse } from "./requester";
import type { GitHubRepo } from "./schemas";

const NOW = new Date("2025-06-01T00:00:00Z");
const PUSHED_AT = "2024-01-01T00:00:00Z";

const repo: GitHubRepo = {
  name: "tomb",
  html_url: "https://github.com/me/tomb",
  description: null,
  fork: false,
  archived: false,
  stargazers_count: 1,
  open_issues_count: 0,
  language: null,
  pushed_at: PUSHED_AT,
  default_branch: "main",
  owner: { login: "me" },
};

type Handler = (params: Record<string, unknown>) => GitHubResponse | Error;
type Handlers = Partial<Record<"commit" | "ci" | "readme" | "manifest", Handler>>;

function ok(data: unknown): GitHubResponse {
  return { status: 200, headers: {}, data };
}

function httpError(status: number, headers: Record<string, string> = {}, message = "x") {
  return Object.assign(new Error(message), { status, response: { headers } });
}

function commits(date: string) {
  return [{ commit: { committer: { date } } }];
}

const defaults: Required<Handlers> = {
  commit: () => ok(commits("2025-05-01T00:00:00Z")),
  ci: () => ok({ total_count: 1, check_runs: [{ conclusion: "success" }] }),
  readme: () => ok({ name: "README.md" }),
  manifest: () => ok(commits("2025-04-01T00:00:00Z")),
};

function fake(overrides: Handlers = {}): { request: GitHubRequester; routes: string[] } {
  const handlers = { ...defaults, ...overrides };
  const routes: string[] = [];
  const request: GitHubRequester = async (route, params) => {
    routes.push(route);
    let handler: Handler;
    if (route === CHECK_RUNS_ROUTE) handler = handlers.ci;
    else if (route === README_ROUTE) handler = handlers.readme;
    else if (params.path === "package.json") handler = handlers.manifest;
    else handler = handlers.commit;
    const result = handler(params);
    if (result instanceof Error) throw result;
    return result;
  };
  return { request, routes };
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ScanFailureError) return error.failure;
    throw error;
  }
  throw new Error("expected rejection");
}

describe("fetchRepoDetails", () => {
  it("returns all four lookups for a healthy repo", async () => {
    const { request, routes } = fake();
    const details = await fetchRepoDetails(request, repo, NOW);
    expect(details).toEqual({
      lastCommitAt: "2025-05-01T00:00:00Z",
      ciStatus: "passing",
      hasReadme: true,
      outdatedDeps: false,
    });
    expect(routes).toHaveLength(4);
  });

  it("marks stale manifest as outdated", async () => {
    const { request } = fake({ manifest: () => ok(commits("2023-01-01T00:00:00Z")) });
    expect((await fetchRepoDetails(request, repo, NOW)).outdatedDeps).toBe(true);
  });

  it("gives outdatedDeps null when no commit touches package.json", async () => {
    const { request } = fake({ manifest: () => ok([]) });
    expect((await fetchRepoDetails(request, repo, NOW)).outdatedDeps).toBeNull();
  });

  it("gives ciStatus failing for a failing-CI repo", async () => {
    const { request } = fake({
      ci: () => ok({ total_count: 2, check_runs: [{ conclusion: "success" }, { conclusion: "failure" }] }),
    });
    expect((await fetchRepoDetails(request, repo, NOW)).ciStatus).toBe("failing");
  });

  it("gives ciStatus none for 404 check runs and for an empty list", async () => {
    const a = fake({ ci: () => httpError(404) });
    expect((await fetchRepoDetails(a.request, repo, NOW)).ciStatus).toBe("none");
    const b = fake({ ci: () => ok({ total_count: 0, check_runs: [] }) });
    expect((await fetchRepoDetails(b.request, repo, NOW)).ciStatus).toBe("none");
  });

  it("gives hasReadme false on 404", async () => {
    const { request } = fake({ readme: () => httpError(404) });
    expect((await fetchRepoDetails(request, repo, NOW)).hasReadme).toBe(false);
  });

  it("treats 409 as an empty repo and skips the other lookups", async () => {
    const { request, routes } = fake({ commit: () => httpError(409) });
    expect(await fetchRepoDetails(request, repo, NOW)).toEqual({
      lastCommitAt: null,
      ciStatus: "none",
      hasReadme: false,
      outdatedDeps: null,
    });
    expect(routes).toHaveLength(1);
  });

  it("treats an empty commit list as an empty repo", async () => {
    const { request, routes } = fake({ commit: () => ok([]) });
    expect((await fetchRepoDetails(request, repo, NOW)).lastCommitAt).toBeNull();
    expect(routes).toHaveLength(1);
  });

  it("falls back to defaults on 500 and network failures", async () => {
    const { request } = fake({
      commit: () => httpError(500),
      ci: () => new Error("network down"),
      readme: () => httpError(502),
      manifest: () => httpError(500),
    });
    expect(await fetchRepoDetails(request, repo, NOW)).toEqual({
      lastCommitAt: PUSHED_AT,
      ciStatus: "none",
      hasReadme: false,
      outdatedDeps: null,
    });
  });

  it("aborts on 401 from any lookup", async () => {
    const { request } = fake({ readme: () => httpError(401) });
    expect(await failureOf(fetchRepoDetails(request, repo, NOW))).toEqual({ kind: "token_revoked" });
  });

  it("aborts on a 403 rate limit with x-ratelimit-remaining 0", async () => {
    const { request } = fake({
      ci: () => httpError(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1750000000" }),
    });
    const failure = await failureOf(fetchRepoDetails(request, repo, NOW));
    expect(failure).toMatchObject({ kind: "rate_limited" });
  });

  it("falls back on a plain 403 (permission) without aborting", async () => {
    const { request } = fake({ readme: () => httpError(403) });
    expect((await fetchRepoDetails(request, repo, NOW)).hasReadme).toBe(false);
  });

  it.each(["commit", "ci", "readme", "manifest"] as const)(
    "raises invalid_response when the %s payload fails Zod",
    async (key) => {
      const { request } = fake({ [key]: () => ok({ nope: true }) });
      expect(await failureOf(fetchRepoDetails(request, repo, NOW))).toEqual({ kind: "invalid_response" });
    },
  );
});

describe("detail routes", () => {
  it("are all GET routes", () => {
    expect(DETAIL_ROUTES.length).toBeGreaterThan(0);
    for (const route of DETAIL_ROUTES) expect(route.startsWith("GET ")).toBe(true);
    expect(LATEST_COMMIT_ROUTE.startsWith("GET ")).toBe(true);
  });
});

describe("lookupOutdatedDeps", () => {
  it("returns true when the latest package.json commit is stale", async () => {
    const { request } = fake({ manifest: () => ok(commits("2024-01-01T00:00:00Z")) });
    expect(await lookupOutdatedDeps(request, repo, NOW)).toBe(true);
  });

  it("returns null when no commit touches package.json", async () => {
    const { request } = fake({ manifest: () => ok([]) });
    expect(await lookupOutdatedDeps(request, repo, NOW)).toBeNull();
  });
});
