import { describe, expect, it, vi } from "vitest";
import type { GitHubRequester } from "../github/requester";
import { getSampleRepos } from "../demo/sample-repos";
import { createScanCache } from "./cache";
import { handleScan, type ScanDeps } from "./handler";
import { ERROR_TABLE, SafeErrorSchema, ScanSuccessSchema, type ErrorCode } from "./response";

const NOW = new Date("2025-06-01T00:00:00.000Z");
const USER_TOKEN = "gho_user_secret_token";
const DEMO_TOKEN = "ghp_demo_secret_token";
const AUTH_ENV = { GITHUB_ID: "id", GITHUB_SECRET: "secret", AUTH_SECRET: "auth" };
const DEMO_ENV = { GITHUB_DEMO_USERNAME: "octodemo", GITHUB_DEMO_TOKEN: DEMO_TOKEN };

type RepoOpts = { fork?: boolean; archived?: boolean; failing?: boolean };

function repoPayload(name: string, opts: RepoOpts = {}) {
  return {
    name,
    html_url: `https://github.com/octo/${name}`,
    description: null,
    fork: opts.fork ?? false,
    archived: opts.archived ?? false,
    stargazers_count: 1,
    open_issues_count: 0,
    language: "TypeScript",
    pushed_at: "2025-05-01T00:00:00Z",
    default_branch: "main",
    owner: { login: "octo" },
  };
}

type Fake = {
  requester: GitHubRequester;
  calls: string[];
};

type FakeOpts = {
  repos?: Array<ReturnType<typeof repoPayload>>;
  listData?: unknown;
  listError?: unknown;
  detailError?: unknown;
  failing?: Set<string>;
};

function fakeGitHub(opts: FakeOpts = {}): Fake {
  const repos = opts.repos ?? [];
  const calls: string[] = [];
  const requester: GitHubRequester = async (route, params) => {
    calls.push(route);
    if (route.includes("/repos") && !route.includes("{owner}")) {
      if (opts.listError !== undefined) throw opts.listError;
      if (opts.listData !== undefined) return { status: 200, headers: {}, data: opts.listData };
      const page = typeof params.page === "number" ? params.page : 1;
      const slice = repos.slice((page - 1) * 100, page * 100);
      const hasNext = page * 100 < repos.length;
      return {
        status: 200,
        headers: hasNext ? { link: '<https://api.github.com/x?page=2>; rel="next"' } : {},
        data: slice,
      };
    }
    if (opts.detailError !== undefined) throw opts.detailError;
    if (route.endsWith("/check-runs")) {
      const failing = opts.failing?.has(String(params.repo)) ?? false;
      return {
        status: 200,
        headers: {},
        data: { total_count: 1, check_runs: [{ conclusion: failing ? "failure" : "success" }] },
      };
    }
    if (route.endsWith("/readme")) return { status: 200, headers: {}, data: { name: "README.md" } };
    const date = params.path === "package.json" ? "2025-05-01T00:00:00Z" : "2025-05-20T00:00:00Z";
    return { status: 200, headers: {}, data: [{ commit: { committer: { date } } }] };
  };
  return { requester, calls };
}

type Harness = {
  deps: ScanDeps;
  fake: Fake;
  cache: ReturnType<typeof createScanCache>;
  readUserToken: ReturnType<typeof vi.fn>;
  makeRequester: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
  tokensUsed: Array<string | null>;
};

function harness(
  fakeOpts: FakeOpts = {},
  env: Record<string, string | undefined> = { ...AUTH_ENV, ...DEMO_ENV },
  user: { login: string; accessToken: string } | null = { login: "Octo", accessToken: USER_TOKEN },
  clock: { value: Date } = { value: NOW },
): Harness {
  const fake = fakeGitHub(fakeOpts);
  const cache = createScanCache();
  const tokensUsed: Array<string | null> = [];
  const makeRequester = vi.fn((token: string | null) => {
    tokensUsed.push(token);
    return fake.requester;
  });
  const readUserToken = vi.fn(async () => user);
  const log = vi.fn();
  const deps: ScanDeps = { now: () => clock.value, env, cache, makeRequester, readUserToken, log };
  return { deps, fake, cache, readUserToken, makeRequester, log, tokensUsed };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/scan", { method: "POST", body: text, headers });
}

async function errorOf(res: Response, code: ErrorCode) {
  expect(res.status).toBe(ERROR_TABLE[code].status);
  const text = await res.clone().text();
  const parsed = SafeErrorSchema.parse(JSON.parse(text));
  expect(parsed.error.code).toBe(code);
  expect(parsed.error.message).toBe(ERROR_TABLE[code].message);
  return parsed;
}

async function successOf(res: Response) {
  expect(res.status).toBe(200);
  return ScanSuccessSchema.parse(await res.json());
}

const repos = [repoPayload("alpha"), repoPayload("beta")];

describe("handleScan validation", () => {
  it.each([["not json"], [{ demo: "yes" }], [{ includeForks: 1 }], ["[]"]])("rejects %j with 400", async (body) => {
    const h = harness({ repos });
    await errorOf(await handleScan(h.deps, post(body)), "validation_error");
    expect(h.fake.calls).toEqual([]);
    expect(h.log).toHaveBeenCalledWith({ code: "validation_error", requestId: expect.any(String) });
  });

  it("treats an empty body as defaults", async () => {
    const h = harness({ repos });
    const body = await successOf(await handleScan(h.deps, post("")));
    expect(body.mode).toBe("user");
  });
});

describe("handleScan signed-in branch", () => {
  it("returns auth_not_configured when auth env is missing", async () => {
    const h = harness({ repos }, { ...DEMO_ENV });
    await errorOf(await handleScan(h.deps, post({})), "auth_not_configured");
    expect(h.fake.calls).toEqual([]);
  });

  it("returns 401 unauthorized with no session", async () => {
    const h = harness({ repos }, undefined, null);
    await errorOf(await handleScan(h.deps, post({})), "unauthorized");
    expect(h.fake.calls).toEqual([]);
  });

  it("scans with the session token and stores the result under user:<login>", async () => {
    const h = harness({ repos });
    const body = await successOf(await handleScan(h.deps, post({})));
    expect(body.mode).toBe("user");
    expect(body.repos.map((r) => r.name)).toEqual(["alpha", "beta"]);
    expect(h.tokensUsed).toEqual([USER_TOKEN]);
    expect(h.cache.get("user:octo", NOW.getTime(), 1000, false)).not.toBeNull();
  });

  it("ignores a username in the body", async () => {
    const h = harness({ repos });
    await successOf(await handleScan(h.deps, post({ username: "someone-else" })));
    expect(h.tokensUsed).toEqual([USER_TOKEN]);
  });

  it("returns empty_account for zero repos", async () => {
    const h = harness({ repos: [] });
    const body = await successOf(await handleScan(h.deps, post({})));
    expect(body.code).toBe("empty_account");
    expect(body.repos).toEqual([]);
  });

  it("returns empty_account for an all-fork account with skippedForks counted", async () => {
    const h = harness({ repos: [repoPayload("f1", { fork: true }), repoPayload("f2", { fork: true })] });
    const body = await successOf(await handleScan(h.deps, post({})));
    expect(body.code).toBe("empty_account");
    expect(body.skippedForks).toBe(2);
  });

  it("returns 300 repos with truncated true for 301+ repos", async () => {
    const many = Array.from({ length: 320 }, (_, i) => repoPayload(`r${String(i).padStart(3, "0")}`));
    const h = harness({ repos: many });
    const body = await successOf(await handleScan(h.deps, post({})));
    expect(body.repos).toHaveLength(300);
    expect(body.truncated).toBe(true);
    expect(body.code).toBeUndefined();
  });

  it("includes a failing-CI repo and an archived repo", async () => {
    const h = harness({
      repos: [repoPayload("broken"), repoPayload("old", { archived: true }), repoPayload("fine")],
      failing: new Set(["broken"]),
    });
    const body = await successOf(await handleScan(h.deps, post({})));
    expect(body.repos.find((r) => r.name === "broken")?.ciStatus).toBe("failing");
    expect(body.repos.find((r) => r.name === "fine")?.ciStatus).toBe("passing");
    expect(body.repos.find((r) => r.name === "old")?.archived).toBe(true);
  });

  it("excludes forks by default and includes them with includeForks", async () => {
    const list = [repoPayload("own"), repoPayload("forked", { fork: true })];
    const excluded = await successOf(await handleScan(harness({ repos: list }).deps, post({})));
    expect(excluded.repos.map((r) => r.name)).toEqual(["own"]);
    expect(excluded.skippedForks).toBe(1);
    const included = await successOf(
      await handleScan(harness({ repos: list }).deps, post({ includeForks: true })),
    );
    expect(included.repos.map((r) => r.name)).toEqual(["forked", "own"]);
    expect(included.skippedForks).toBe(0);
  });

  it("counts invalid entries without failing and does not report empty_account", async () => {
    const h = harness({ listData: [repoPayload("ok"), { bogus: true }] });
    const body = await successOf(await handleScan(h.deps, post({})));
    expect(body.skippedInvalid).toBe(1);
    expect(body.repos).toHaveLength(1);
  });

  it("returns invalid_github_response when every entry is invalid", async () => {
    const h = harness({ listData: [{ a: 1 }, { b: 2 }] });
    const res = await handleScan(h.deps, post({}));
    await errorOf(res, "invalid_github_response");
  });

  it("returns invalid_github_response for a non-array list", async () => {
    const h = harness({ listData: { message: "oops" } });
    await errorOf(await handleScan(h.deps, post({})), "invalid_github_response");
  });
});

describe("handleScan failure mapping", () => {
  const listFailure = (status: number, headers: Record<string, string> = {}, message = "boom") => ({
    status,
    message,
    response: { headers },
  });

  it("maps 404 to account_not_found", async () => {
    const h = harness({ listError: listFailure(404, {}, "Not Found secret-text") });
    const res = await handleScan(h.deps, post({}));
    await errorOf(res, "account_not_found");
    expect(JSON.stringify(await res.clone().json())).not.toContain("secret-text");
  });

  it("maps 403 without rate-limit signals to forbidden and keeps the session", async () => {
    const h = harness({ listError: listFailure(403) });
    const res = await handleScan(h.deps, post({}, { cookie: "next-auth.session-token=abc" }));
    await errorOf(res, "forbidden");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("maps 401 to token_revoked and clears session cookies", async () => {
    const h = harness({ listError: listFailure(401) });
    const res = await handleScan(
      h.deps,
      post({}, { cookie: "next-auth.session-token.0=a; next-auth.session-token.1=b; theme=dark" }),
    );
    await errorOf(res, "token_revoked");
    const cleared = res.headers.getSetCookie();
    expect(cleared).toHaveLength(2);
    expect(cleared.every((c) => c.includes("Max-Age=0"))).toBe(true);
    expect(cleared.join(";")).not.toContain("theme");
  });

  it("maps a 401 during detail lookups to token_revoked with no partial result", async () => {
    const h = harness({ repos, detailError: listFailure(401) });
    await errorOf(await handleScan(h.deps, post({})), "token_revoked");
  });

  it.each([[500], [503]])("maps %i to github_unavailable", async (status) => {
    const h = harness({ listError: listFailure(status) });
    await errorOf(await handleScan(h.deps, post({})), "github_unavailable");
  });

  it("maps a network error to github_unavailable and never empty_account", async () => {
    const h = harness({ listError: new Error("ECONNRESET token=" + USER_TOKEN) });
    const res = await handleScan(h.deps, post({}));
    const parsed = await errorOf(res, "github_unavailable");
    expect(JSON.stringify(parsed)).not.toContain("empty_account");
    expect(JSON.stringify(parsed)).not.toContain(USER_TOKEN);
  });

  it("maps a 403 rate limit to 429 with resetAt and no cache", async () => {
    const h = harness({
      listError: listFailure(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1750000000" }),
    });
    const parsed = await errorOf(await handleScan(h.deps, post({})), "rate_limited");
    expect(parsed.error.resetAt).toBe(new Date(1750000000 * 1000).toISOString());
  });

  it("maps a 429 without reset headers to 429 without resetAt", async () => {
    const h = harness({ listError: listFailure(429) });
    const parsed = await errorOf(await handleScan(h.deps, post({})), "rate_limited");
    expect(parsed.error.resetAt).toBeUndefined();
  });

  it("serves a stale cached result in user mode on a rate limit", async () => {
    const clock = { value: NOW };
    const h = harness({ repos }, undefined, undefined, clock);
    await successOf(await handleScan(h.deps, post({})));

    clock.value = new Date(NOW.getTime() + 60_000);
    const limited = harness({
      listError: listFailure(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1750000000" }),
    });
    // Reuse the populated cache with a rate-limited GitHub.
    const deps: ScanDeps = { ...limited.deps, cache: h.cache, now: () => clock.value };
    const body = await successOf(await handleScan(deps, post({})));
    expect(body.stale).toBe(true);
    expect(body.code).toBe("rate_limited");
    expect(body.cachedAt).toBe(NOW.toISOString());
    expect(body.resetAt).toBe(new Date(1750000000 * 1000).toISOString());
    expect(body.repos.map((r) => r.name)).toEqual(["alpha", "beta"]);
  });

  it("returns 429 when the cached entry is expired", async () => {
    const clock = { value: NOW };
    const h = harness({ repos }, undefined, undefined, clock);
    await successOf(await handleScan(h.deps, post({})));
    clock.value = new Date(NOW.getTime() + 3_600_000);
    const limited = harness({ listError: listFailure(429) });
    const deps: ScanDeps = { ...limited.deps, cache: h.cache, now: () => clock.value };
    await errorOf(await handleScan(deps, post({})), "rate_limited");
  });

  it("returns 429 when the cached entry has a different includeForks setting", async () => {
    const h = harness({ repos });
    await successOf(await handleScan(h.deps, post({})));
    const limited = harness({ listError: listFailure(429) });
    const deps: ScanDeps = { ...limited.deps, cache: h.cache };
    await errorOf(await handleScan(deps, post({ includeForks: true })), "rate_limited");
  });

  it("maps invalid detail payloads to invalid_github_response", async () => {
    const h = harness({ repos });
    const bad: GitHubRequester = async (route, params) => {
      if (route.endsWith("/check-runs")) return { status: 200, headers: {}, data: { nope: 1 } };
      return h.fake.requester(route, params);
    };
    const deps: ScanDeps = { ...h.deps, makeRequester: () => bad };
    await errorOf(await handleScan(deps, post({})), "invalid_github_response");
  });

  it("maps a throwing token read to unauthorized, and logs a redacted diagnostic", async () => {
    const h = harness({ repos });
    const FAKE = "ghp_FAKEfakeFAKE0123456789abcdefABCDEF01";
    const deps: ScanDeps = {
      ...h.deps,
      readUserToken: async () => {
        throw new TypeError(`stack with ${USER_TOKEN} and ${FAKE} and Bearer abc.def`);
      },
    };
    const res = await handleScan(deps, post({}));
    await errorOf(res, "unauthorized");
    expect(h.fake.calls).toEqual([]);
    const logged = vi.fn();
    await handleScan({ ...deps, log: logged }, post({}));
    expect(logged).toHaveBeenCalledTimes(1);
    const entry = logged.mock.calls[0]?.[0];
    expect(Object.keys(entry).sort()).toEqual(["code", "errorName", "message", "requestId", "step"]);
    expect(entry).toMatchObject({ code: "unauthorized", errorName: "TypeError", step: "read-token" });
    expect(entry.message).toContain("[redacted]");
    expect(entry.message.length).toBeLessThanOrEqual(120);
    const text = JSON.stringify(entry);
    for (const secret of [USER_TOKEN, FAKE, "abc.def"]) expect(text).not.toContain(secret);
  });

  it("maps an unexpected exception in each stage to a typed code and names the step", async () => {
    const cases: Array<{ name: string; patch: (h: ReturnType<typeof harness>) => ScanDeps; code: ErrorCode; step: string }> = [
      {
        name: "creating the requester",
        patch: (h) => ({
          ...h.deps,
          makeRequester: () => {
            throw new TypeError("requester broke");
          },
        }),
        code: "github_unavailable",
        step: "list-repos",
      },
      {
        name: "writing the cache",
        patch: (h) => ({
          ...h.deps,
          cache: {
            get: () => null,
            set: () => {
              throw new RangeError("cache broke");
            },
          },
        }),
        code: "invalid_github_response",
        step: "build-response",
      },
    ];
    for (const item of cases) {
      const h = harness({ repos });
      const logged = vi.fn();
      const res = await handleScan({ ...item.patch(h), log: logged }, post({}));
      await errorOf(res, item.code);
      const entry = logged.mock.calls[0]?.[0];
      expect(entry, item.name).toMatchObject({ code: item.code, step: item.step });
      expect(entry.errorName, item.name).toMatch(/Error$/);
    }
  });

  it("logs only code and requestId for a normal, known failure", async () => {
    const h = harness({ listError: { status: 404, message: "Not Found", response: { headers: {} } } });
    await handleScan(h.deps, post({}));
    expect(h.log).toHaveBeenCalledTimes(1);
    expect(Object.keys(h.log.mock.calls[0]?.[0]).sort()).toEqual(["code", "requestId"]);
  });

  it("answers a response that fails validation with a typed code and the failing field path", async () => {
    const h = harness({ repos });
    h.cache.set("demo", { repos: [{ name: "x" } as never], skippedForks: 0, skippedInvalid: 0, truncated: false }, false, NOW.getTime());
    const logged = vi.fn();
    const res = await handleScan({ ...h.deps, log: logged }, post({ demo: true }));
    await errorOf(res, "invalid_github_response");
    const entry = logged.mock.calls[0]?.[0];
    expect(entry).toMatchObject({ code: "invalid_github_response", step: "build-response", errorName: "ResponseValidation" });
    expect(entry.message).toMatch(/^repos\.0\./);
  });
});

describe("handleScan demo branch", () => {
  it("never reads the session and scans with the demo token", async () => {
    const h = harness({ repos });
    const body = await successOf(await handleScan(h.deps, post({ demo: true })));
    expect(body.mode).toBe("demo");
    expect(h.readUserToken).not.toHaveBeenCalled();
    expect(h.tokensUsed).toEqual([DEMO_TOKEN]);
    expect(h.fake.calls[0]).toBe("GET /users/{username}/repos");
    expect(h.cache.get("demo", NOW.getTime(), 1000, false)).not.toBeNull();
    expect(h.cache.get("user:octo", NOW.getTime(), 1000, false)).toBeNull();
  });

  it("works without a demo token and without auth env", async () => {
    const h = harness({ repos }, { GITHUB_DEMO_USERNAME: "octodemo" });
    const body = await successOf(await handleScan(h.deps, post({ demo: true })));
    expect(body.mode).toBe("demo");
    expect(h.tokensUsed).toEqual([null]);
  });

  it("falls back to sample repos without calling GitHub when the demo username is missing", async () => {
    const h = harness({ repos }, { ...AUTH_ENV, GITHUB_DEMO_TOKEN: DEMO_TOKEN });
    const res = await handleScan(h.deps, post({ demo: true }));
    const body = await successOf(res);
    expect(body.mode).toBe("demo");
    expect(body.sampleData).toBe(true);
    expect(body.repos).toEqual(getSampleRepos(NOW));
    expect(body.repos).toHaveLength(8);
    expect(h.makeRequester).not.toHaveBeenCalled();
    expect(h.fake.calls).toEqual([]);
    expect(h.readUserToken).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain(DEMO_TOKEN);
    expect(h.log).toHaveBeenCalledWith({ code: "demo_sample_no_username", requestId: expect.any(String) });
    // Sample data is never cached.
    expect(h.cache.get("demo", NOW.getTime(), 1000, false)).toBeNull();
  });

  it("falls back to sample repos for an invalid demo username", async () => {
    const h = harness({ repos }, { GITHUB_DEMO_USERNAME: "bad name!" });
    const body = await successOf(await handleScan(h.deps, post({ demo: true })));
    expect(body.sampleData).toBe(true);
    expect(h.fake.calls).toEqual([]);
  });

  it("does not set sampleData for real GitHub data", async () => {
    const h = harness({ repos });
    const body = await successOf(await handleScan(h.deps, post({ demo: true })));
    expect(body.sampleData).toBeUndefined();
  });

  it("serves a fresh cache hit without calling GitHub, then expires after 5 minutes", async () => {
    const clock = { value: NOW };
    const h = harness({ repos }, undefined, undefined, clock);
    await successOf(await handleScan(h.deps, post({ demo: true })));
    const callsAfterFirst = h.fake.calls.length;

    clock.value = new Date(NOW.getTime() + 299_000);
    const hit = await successOf(await handleScan(h.deps, post({ demo: true })));
    expect(hit.mode).toBe("demo");
    expect(h.fake.calls).toHaveLength(callsAfterFirst);

    clock.value = new Date(NOW.getTime() + 300_000);
    await successOf(await handleScan(h.deps, post({ demo: true })));
    expect(h.fake.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it("leaves the demo cache untouched after a failed scan", async () => {
    const clock = { value: NOW };
    const h = harness({ repos }, undefined, undefined, clock);
    await successOf(await handleScan(h.deps, post({ demo: true })));
    const before = h.cache.get("demo", NOW.getTime(), 300_000, false);

    // A different includeForks setting is a cache miss, so the scan runs and fails.
    clock.value = new Date(NOW.getTime() + 1_000);
    const failing = harness({ listError: { status: 500 } });
    const deps: ScanDeps = { ...failing.deps, cache: h.cache, now: () => clock.value };
    const fallback = await successOf(await handleScan(deps, post({ demo: true, includeForks: true })));
    expect(fallback.sampleData).toBe(true);
    expect(failing.fake.calls.length).toBeGreaterThan(0);
    expect(h.cache.get("demo", NOW.getTime(), 300_000, false)).toBe(before);
  });

  it("falls back to sample repos when GitHub answers 403 rate limited", async () => {
    const limited = harness({
      listError: {
        status: 403,
        message: "API rate limit exceeded",
        response: { headers: { "x-ratelimit-remaining": "0" } },
      },
    });
    const res = await handleScan(limited.deps, post({ demo: true }));
    const body = await successOf(res);
    expect(body.mode).toBe("demo");
    expect(body.sampleData).toBe(true);
    expect(body.repos).toEqual(getSampleRepos(NOW));
    expect(limited.fake.calls.length).toBeGreaterThan(0);
    expect(limited.log).toHaveBeenCalledWith({
      code: "demo_sample_rate_limited",
      requestId: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toContain(DEMO_TOKEN);
  });

  it("falls back to sample repos on a 429, ignoring the user cache", async () => {
    const h = harness({ repos });
    await successOf(await handleScan(h.deps, post({})));
    const limited = harness({ listError: { status: 429 } });
    const deps: ScanDeps = { ...limited.deps, cache: h.cache };
    const body = await successOf(await handleScan(deps, post({ demo: true })));
    expect(body.sampleData).toBe(true);
    expect(body.repos).toEqual(getSampleRepos(NOW));
  });

  it.each([
    ["a rejected demo token (401)", { status: 401 }, "demo_sample_token_revoked"],
    ["a missing demo account (404)", { status: 404 }, "demo_sample_not_found"],
    ["a GitHub outage (500)", { status: 500 }, "demo_sample_unavailable"],
  ])("falls back to sample repos on %s without clearing cookies", async (_label, listError, code) => {
    const h = harness({ listError });
    const res = await handleScan(
      h.deps,
      post({ demo: true }, { cookie: "next-auth.session-token=abc" }),
    );
    const body = await successOf(res);
    expect(body.sampleData).toBe(true);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(h.log).toHaveBeenCalledWith({ code, requestId: expect.any(String) });
  });

  it("does not fall back for the signed-in branch", async () => {
    const h = harness({ listError: { status: 500 } });
    await errorOf(await handleScan(h.deps, post({})), "github_unavailable");
  });

  it("returns empty_account for an empty demo account", async () => {
    const h = harness({ repos: [] });
    const body = await successOf(await handleScan(h.deps, post({ demo: true })));
    expect(body.code).toBe("empty_account");
  });
});

describe("handleScan secrecy", () => {
  it("never puts tokens in success bodies or cache entries", async () => {
    const h = harness({ repos });
    const user = await handleScan(h.deps, post({}));
    const demo = await handleScan(h.deps, post({ demo: true }));
    for (const res of [user, demo]) {
      const text = await res.text();
      expect(text).not.toContain(USER_TOKEN);
      expect(text).not.toContain(DEMO_TOKEN);
    }
    const userEntry = h.cache.get("user:octo", NOW.getTime(), 1000, false);
    const demoEntry = h.cache.get("demo", NOW.getTime(), 1000, false);
    expect(JSON.stringify(userEntry)).not.toContain(USER_TOKEN);
    expect(JSON.stringify(demoEntry)).not.toContain(DEMO_TOKEN);
  });

  it("success body contains only schema fields", async () => {
    const h = harness({ repos });
    const body: Record<string, unknown> = await (await handleScan(h.deps, post({}))).json();
    expect(Object.keys(body).sort()).toEqual(["mode", "repos", "skippedForks", "skippedInvalid", "truncated"]);
  });

  it("error bodies never contain tokens or upstream text", async () => {
    const h = harness({
      listError: { status: 500, message: `leak ${USER_TOKEN} ${DEMO_TOKEN}`, response: { headers: {} } },
    });
    for (const body of [{}, { demo: true }]) {
      const res = await handleScan(h.deps, post(body));
      const text = await res.text();
      expect(text).not.toContain(USER_TOKEN);
      expect(text).not.toContain(DEMO_TOKEN);
      expect(text).not.toContain("leak");
    }
  });
});
