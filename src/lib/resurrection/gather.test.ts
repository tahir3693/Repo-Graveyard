import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScanFailureError } from "@/lib/github/errors";
import type { GitHubResponse } from "@/lib/github/requester";
import { gatherContext } from "./gather";
import type { ReadRequester } from "./read-only";

const NOW = new Date("2025-06-01T00:00:00Z");

const META = {
  name: "todo-app",
  html_url: "https://github.com/octocat/todo-app",
  description: "d",
  fork: false,
  archived: false,
  stargazers_count: 1,
  open_issues_count: 0,
  language: "TypeScript",
  pushed_at: "2024-01-01T00:00:00Z",
  default_branch: "main",
  owner: { login: "octocat" },
};

function ok(data: unknown): GitHubResponse {
  return { status: 200, headers: {}, data };
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly response: { headers: Record<string, string> } = { headers: {} },
  ) {
    super("http");
  }
}

type Handler = (params: Record<string, unknown>) => Promise<GitHubResponse> | GitHubResponse;

function defaults(): Record<string, Handler> {
  return {
    "GET /repos/{owner}/{repo}": () => ok(META),
    "GET /repos/{owner}/{repo}/readme": () => ok("# Hello"),
    "GET /repos/{owner}/{repo}/git/trees/{tree_sha}": () => ok({ tree: [{ path: "src", type: "tree" }] }),
    "GET /repos/{owner}/{repo}/commits": (p) =>
      p.path === "package.json"
        ? ok([{ commit: { committer: { date: "2024-01-01T00:00:00Z" } } }])
        : ok([{ commit: { message: "fix: a", committer: { date: "2024-02-01T00:00:00Z" } } }]),
    "GET /repos/{owner}/{repo}/commits/{ref}/check-runs": () =>
      ok({ total_count: 1, check_runs: [{ name: "build", conclusion: "success" }] }),
    "GET /repos/{owner}/{repo}/issues": () => ok([{ title: "Bug" }, { title: "PR", pull_request: {} }]),
  };
}

function makeRequester(overrides: Record<string, Handler> = {}) {
  const handlers = { ...defaults(), ...overrides };
  const routes: string[] = [];
  const request: ReadRequester = async (route, params) => {
    routes.push(route);
    const handler = handlers[route];
    if (handler === undefined) throw new HttpError(404);
    return handler(params);
  };
  return { request, routes };
}

const gather = (request: ReadRequester) => gatherContext({ request, now: NOW }, "octocat", "todo-app");

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error instanceof ScanFailureError ? error.failure : error;
  }
  return undefined;
}

describe("gatherContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns all six reads and drops pull requests", async () => {
    const { request, routes } = makeRequester();
    const raw = await gather(request);
    expect(raw.repo.name).toBe("todo-app");
    expect(raw.readme).toBe("# Hello");
    expect(raw.tree).toEqual([{ path: "src", type: "tree" }]);
    expect(raw.commits).toEqual([{ message: "fix: a", date: "2024-02-01T00:00:00Z" }]);
    expect(raw.checks).toEqual([{ name: "build", conclusion: "success" }]);
    expect(raw.issues).toEqual([{ title: "Bug" }]);
    expect(raw.outdatedDeps).toBe(true);
    expect(routes).toHaveLength(7);
    expect(routes.every((r) => r.startsWith("GET "))).toBe(true);
  });

  it("sets a field to null when its response fails validation", async () => {
    const { request } = makeRequester({ "GET /repos/{owner}/{repo}/issues": () => ok({ nope: 1 }) });
    const raw = await gather(request);
    expect(raw.issues).toBeNull();
    expect(raw.readme).toBe("# Hello");
  });

  it("maps 404 and 409 to empty values", async () => {
    const { request } = makeRequester({
      "GET /repos/{owner}/{repo}/readme": () => {
        throw new HttpError(404);
      },
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}": () => {
        throw new HttpError(409);
      },
      "GET /repos/{owner}/{repo}/commits": () => {
        throw new HttpError(409);
      },
      "GET /repos/{owner}/{repo}/commits/{ref}/check-runs": () => {
        throw new HttpError(404);
      },
    });
    const raw = await gather(request);
    expect(raw.readme).toBe("");
    expect(raw.tree).toEqual([]);
    expect(raw.commits).toEqual([]);
    expect(raw.checks).toEqual([]);
    expect(raw.outdatedDeps).toBeNull();
  });

  it("sets non-fatal failures such as 500 to null", async () => {
    const { request } = makeRequester({
      "GET /repos/{owner}/{repo}/readme": () => {
        throw new HttpError(500);
      },
    });
    expect((await gather(request)).readme).toBeNull();
  });

  it("sets a read that misses the deadline to null and ignores its late response", async () => {
    const { request } = makeRequester({
      "GET /repos/{owner}/{repo}/readme": () => new Promise<GitHubResponse>(() => undefined),
    });
    const promise = gather(request);
    await vi.advanceTimersByTimeAsync(10_000);
    const raw = await promise;
    expect(raw.readme).toBeNull();
    expect(raw.tree).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("treats a 401 on any read as fatal token_revoked", async () => {
    const { request } = makeRequester({
      "GET /repos/{owner}/{repo}/issues": () => {
        throw new HttpError(401);
      },
    });
    expect(await failureOf(gather(request))).toEqual({ kind: "token_revoked" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("treats a rate limit on any read as fatal", async () => {
    const { request } = makeRequester({
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}": () => {
        throw new HttpError(429);
      },
    });
    expect(await failureOf(gather(request))).toMatchObject({ kind: "rate_limited" });
  });

  it("maps metadata failures to fatal kinds", async () => {
    const notFound = makeRequester({ "GET /repos/{owner}/{repo}": () => { throw new HttpError(404); } });
    expect(await failureOf(gather(notFound.request))).toEqual({ kind: "not_found" });
    const down = makeRequester({ "GET /repos/{owner}/{repo}": () => { throw new HttpError(503); } });
    expect(await failureOf(gather(down.request))).toEqual({ kind: "unavailable" });
    const bad = makeRequester({ "GET /repos/{owner}/{repo}": () => ok({ name: 1 }) });
    expect(await failureOf(gather(bad.request))).toEqual({ kind: "invalid_response" });
    expect(notFound.routes).toHaveLength(1);
  });

  it("never has more than 5 requests in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const slow: Handler = (p) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise<GitHubResponse>((resolve) => {
        setTimeout(() => {
          inFlight -= 1;
          resolve(defaults()["GET /repos/{owner}/{repo}/commits"](p) as GitHubResponse);
        }, 100);
      });
    };
    const mk = (data: unknown): Handler => () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise<GitHubResponse>((resolve) => {
        setTimeout(() => {
          inFlight -= 1;
          resolve(ok(data));
        }, 100);
      });
    };
    const { request } = makeRequester({
      "GET /repos/{owner}/{repo}/readme": mk("x"),
      "GET /repos/{owner}/{repo}/git/trees/{tree_sha}": mk({ tree: [] }),
      "GET /repos/{owner}/{repo}/commits": slow,
      "GET /repos/{owner}/{repo}/commits/{ref}/check-runs": mk({ total_count: 0, check_runs: [] }),
      "GET /repos/{owner}/{repo}/issues": mk([]),
    });
    const promise = gather(request);
    await vi.advanceTimersByTimeAsync(2_000);
    await promise;
    expect(peak).toBeLessThanOrEqual(5);
    expect(peak).toBeGreaterThan(1);
  });
});
