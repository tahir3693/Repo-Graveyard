import { describe, expect, it } from "vitest";
import { ScanFailureError } from "./errors";
import type { GitHubRequester, GitHubResponse } from "./requester";
import { DEMO_REPOS_ROUTE, USER_REPOS_ROUTE, scanAccount } from "./scan";

const NOW = new Date("2025-06-01T00:00:00Z");

type RawRepo = Record<string, unknown>;

function rawRepo(name: string, overrides: RawRepo = {}): RawRepo {
  return {
    name,
    html_url: `https://github.com/me/${name}`,
    description: null,
    fork: false,
    archived: false,
    stargazers_count: 1,
    open_issues_count: 0,
    language: null,
    pushed_at: "2025-01-01T00:00:00Z",
    default_branch: "main",
    owner: { login: "me" },
    ...overrides,
  };
}

function httpError(status: number, headers: Record<string, string> = {}, message = "x"): Error {
  return Object.assign(new Error(message), { status, response: { headers } });
}

type Options = {
  pages: unknown[][];
  listError?: (page: number) => Error | undefined;
  ci?: (repo: string) => unknown;
  detailError?: (repo: string) => Error | undefined;
};

function fake(options: Options): {
  request: GitHubRequester;
  listCalls: Array<{ route: string; params: Record<string, unknown> }>;
  detailRepos: Set<string>;
} {
  const listCalls: Array<{ route: string; params: Record<string, unknown> }> = [];
  const detailRepos = new Set<string>();
  const ok = (data: unknown, headers: Record<string, string | undefined> = {}): GitHubResponse => ({
    status: 200,
    headers,
    data,
  });
  const request: GitHubRequester = async (route, params) => {
    if (route === USER_REPOS_ROUTE || route === DEMO_REPOS_ROUTE) {
      listCalls.push({ route, params });
      const page = Number(params.page);
      const error = options.listError?.(page);
      if (error) throw error;
      const items = options.pages[page - 1] ?? [];
      const hasNext = page < options.pages.length;
      return ok(items, hasNext ? { link: `<https://api.github.com/x?page=${page + 1}>; rel="next"` } : {});
    }
    const repoName = String(params.repo);
    detailRepos.add(repoName);
    const error = options.detailError?.(repoName);
    if (error) throw error;
    if (route.endsWith("/check-runs")) {
      return ok(options.ci?.(repoName) ?? { total_count: 1, check_runs: [{ conclusion: "success" }] });
    }
    if (route.endsWith("/readme")) return ok({ name: "README.md" });
    return ok([{ commit: { committer: { date: "2025-05-01T00:00:00Z" } } }]);
  };
  return { request, listCalls, detailRepos };
}

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected rejection");
}

const USER = { kind: "user" } as const;

describe("scanAccount", () => {
  it("returns an empty result for an account with no repos", async () => {
    const { request } = fake({ pages: [[]] });
    expect(await scanAccount({ request, now: NOW }, USER, false)).toEqual({
      repos: [],
      skippedForks: 0,
      skippedInvalid: 0,
      truncated: false,
    });
  });

  it("uses the user route with owner affiliation and full_name ascending", async () => {
    const { request, listCalls } = fake({ pages: [[rawRepo("a")]] });
    await scanAccount({ request, now: NOW }, USER, false);
    expect(listCalls[0]).toEqual({
      route: "GET /user/repos",
      params: { per_page: 100, page: 1, sort: "full_name", direction: "asc", affiliation: "owner" },
    });
  });

  it("uses the demo route with owner type", async () => {
    const { request, listCalls } = fake({ pages: [[rawRepo("a")]] });
    await scanAccount({ request, now: NOW }, { kind: "demo", username: "octo" }, false);
    expect(listCalls[0]).toEqual({
      route: "GET /users/{username}/repos",
      params: { per_page: 100, page: 1, sort: "full_name", direction: "asc", username: "octo", type: "owner" },
    });
  });

  it("collects multiple pages", async () => {
    const { request, listCalls } = fake({ pages: [[rawRepo("a")], [rawRepo("b")], [rawRepo("c")]] });
    const data = await scanAccount({ request, now: NOW }, USER, false);
    expect(listCalls).toHaveLength(3);
    expect(data.repos.map((r) => r.name)).toEqual(["a", "b", "c"]);
    expect(data.truncated).toBe(false);
  });

  it("caps 305 repos across 4 pages at 300 and fetches details only for kept repos", async () => {
    const names = Array.from({ length: 305 }, (_, i) => `repo-${String(i).padStart(3, "0")}`);
    const pages = [
      names.slice(0, 100).map((n) => rawRepo(n)),
      names.slice(100, 200).map((n) => rawRepo(n)),
      names.slice(200, 300).map((n) => rawRepo(n)),
      names.slice(300).map((n) => rawRepo(n)),
    ];
    const { request, detailRepos } = fake({ pages });
    const data = await scanAccount({ request, now: NOW }, USER, false);
    expect(data.repos).toHaveLength(300);
    expect(data.truncated).toBe(true);
    expect(detailRepos.size).toBe(300);
    for (const dropped of names.slice(300)) expect(detailRepos.has(dropped)).toBe(false);
  });

  it("counts invalid entries and keeps valid ones", async () => {
    const { request } = fake({ pages: [[rawRepo("good"), { name: 5 }, null]] });
    const data = await scanAccount({ request, now: NOW }, USER, false);
    expect(data.repos.map((r) => r.name)).toEqual(["good"]);
    expect(data.skippedInvalid).toBe(2);
  });

  it("sorts output by name", async () => {
    const { request } = fake({ pages: [[rawRepo("zeta"), rawRepo("alpha"), rawRepo("Mid")]] });
    const data = await scanAccount({ request, now: NOW }, USER, false);
    expect(data.repos.map((r) => r.name)).toEqual(["Mid", "alpha", "zeta"]);
  });

  it("reports ciStatus failing for a repo with a failed check", async () => {
    const { request } = fake({
      pages: [[rawRepo("red")]],
      ci: () => ({ total_count: 1, check_runs: [{ conclusion: "failure" }] }),
    });
    const data = await scanAccount({ request, now: NOW }, USER, false);
    expect(data.repos[0].ciStatus).toBe("failing");
  });

  it("keeps archived repos and marks them archived", async () => {
    const { request } = fake({ pages: [[rawRepo("old", { archived: true })]] });
    const data = await scanAccount({ request, now: NOW }, USER, false);
    expect(data.repos).toHaveLength(1);
    expect(data.repos[0].archived).toBe(true);
  });

  it("excludes forks by default and counts them", async () => {
    const { request, detailRepos } = fake({ pages: [[rawRepo("mine"), rawRepo("forked", { fork: true })]] });
    const data = await scanAccount({ request, now: NOW }, USER, false);
    expect(data.repos.map((r) => r.name)).toEqual(["mine"]);
    expect(data.skippedForks).toBe(1);
    expect(detailRepos.has("forked")).toBe(false);
  });

  it("keeps forks when includeForks is true", async () => {
    const { request } = fake({ pages: [[rawRepo("mine"), rawRepo("forked", { fork: true })]] });
    const data = await scanAccount({ request, now: NOW }, USER, true);
    expect(data.repos.map((r) => r.name)).toEqual(["forked", "mine"]);
    expect(data.skippedForks).toBe(0);
  });

  it("rejects with rate_limited and resetAt on a 403 rate-limit list response", async () => {
    const { request } = fake({
      pages: [[]],
      listError: () => httpError(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1750000000" }),
    });
    const error = await failureOf(scanAccount({ request, now: NOW }, USER, false));
    expect(error).toBeInstanceOf(ScanFailureError);
    expect((error as ScanFailureError).failure).toEqual({
      kind: "rate_limited",
      resetAt: new Date(1750000000 * 1000).toISOString(),
    });
  });

  it("returns no partial result when page 2 fails", async () => {
    const { request } = fake({
      pages: [[rawRepo("a")], [rawRepo("b")]],
      listError: (page) => (page === 2 ? httpError(500) : undefined),
    });
    const error = await failureOf(scanAccount({ request, now: NOW }, USER, false));
    expect(error).toBeInstanceOf(ScanFailureError);
    expect((error as ScanFailureError).failure).toEqual({ kind: "unavailable" });
  });

  it("discards results on a 401 mid-scan", async () => {
    const { request } = fake({
      pages: [[rawRepo("a"), rawRepo("b"), rawRepo("c")]],
      detailError: (repo) => (repo === "b" ? httpError(401) : undefined),
    });
    const error = await failureOf(scanAccount({ request, now: NOW }, USER, false));
    expect(error).toBeInstanceOf(ScanFailureError);
    expect((error as ScanFailureError).failure).toEqual({ kind: "token_revoked" });
  });

  it("fails with invalid_response when the list is not an array", async () => {
    const request: GitHubRequester = async () => ({ status: 200, headers: {}, data: { nope: true } });
    const error = await failureOf(scanAccount({ request, now: NOW }, USER, false));
    expect((error as ScanFailureError).failure).toEqual({ kind: "invalid_response" });
  });
});
