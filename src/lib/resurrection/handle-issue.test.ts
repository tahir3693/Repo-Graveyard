import { describe, expect, it } from "vitest";

import type { IssueWriter } from "@/lib/github/issue-writer";
import type { GitHubRequester, GitHubResponse } from "@/lib/github/requester";

import { readResurrectionConfig } from "./config";
import { ResurrectionErrorSchema } from "./errors";
import { handleIssue, type IssueDeps } from "./handle-issue";
import { createInFlightSet } from "./inflight";
import { ISSUE_FOOTER } from "./issue";
import { DEMO_RESURRECT_LIMIT, ISSUE_LIMIT, RESURRECT_LIMIT } from "./limits";
import { createRateLimitStore } from "./rate-limit";
import { IssueSuccessSchema } from "./response";

const NOW = new Date("2025-06-01T00:00:00Z");
const TOKEN = "ghu_FAKE_user_token_0001";
const UPSTREAM = "SECRET-UPSTREAM";
const ORIGIN = "http://localhost";

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
  has_issues: true,
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly response: { headers: Record<string, string>; data?: unknown } = { headers: {} },
  ) {
    super(`http ${UPSTREAM} ${TOKEN}`);
  }
}

function ok(data: unknown, status = 200): GitHubResponse {
  return { status, headers: {}, data };
}

const CREATED = { number: 7, html_url: "https://github.com/octocat/todo-app/issues/7" };

type HarnessOpts = {
  meta?: unknown;
  getError?: unknown;
  writeError?: unknown;
  writeData?: unknown;
  session?: { login: string; accessToken: string } | null;
};

function makeHarness(opts: HarnessOpts = {}) {
  const getCalls: { route: string; params: Record<string, unknown> }[] = [];
  const posts: { route: string; params: Record<string, unknown> }[] = [];
  const logs: { code: string; requestId: string }[] = [];
  const sessionReads = { count: 0 };
  const session =
    opts.session === undefined ? { login: "Octocat", accessToken: TOKEN } : opts.session;
  const makeRequester = (): GitHubRequester => async (route, params) => {
    getCalls.push({ route, params });
    if (opts.getError !== undefined) throw opts.getError;
    return ok(opts.meta === undefined ? META : opts.meta);
  };
  const makeIssueWriter = (): IssueWriter => async (route, params) => {
    posts.push({ route, params });
    if (opts.writeError !== undefined) throw opts.writeError;
    return ok(opts.writeData === undefined ? CREATED : opts.writeData, 201);
  };
  const state = {
    resurrect: createRateLimitStore(RESURRECT_LIMIT, 100),
    demo: createRateLimitStore(DEMO_RESURRECT_LIMIT, 100),
    issue: createRateLimitStore(ISSUE_LIMIT, 100),
    inFlight: createInFlightSet(),
  };
  const deps: IssueDeps = {
    now: () => NOW,
    config: readResurrectionConfig({ NEXTAUTH_URL: ORIGIN }),
    makeRequester,
    makeIssueWriter,
    readUserToken: async () => {
      sessionReads.count += 1;
      return session;
    },
    state,
    newRequestId: () => "req-1",
    log: (entry) => logs.push(entry),
  };
  return { deps, getCalls, posts, logs, sessionReads, state };
}

const GOOD = { repo: "todo-app", title: "Revive todo-app", body: "Intro.\n\n- [ ] Run it" };

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}/api/issue`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function expectNoSecrets(text: string, res: Response): void {
  const headers = JSON.stringify([...res.headers.entries()]);
  for (const secret of [TOKEN, UPSTREAM]) {
    expect(text).not.toContain(secret);
    expect(headers).not.toContain(secret);
  }
}

async function expectError(res: Response, status: number, code: string): Promise<void> {
  expect(res.status).toBe(status);
  const text = await res.text();
  const parsed = ResurrectionErrorSchema.safeParse(JSON.parse(text));
  expect(parsed.success).toBe(true);
  if (parsed.success) expect(parsed.data.error.code).toBe(code);
  expectNoSecrets(text, res);
}

describe("handleIssue success", () => {
  it("creates exactly one issue with the session login as owner", async () => {
    const h = makeHarness();
    const res = await handleIssue(h.deps, post({ ...GOOD, owner: "someone-else" }));
    expect(res.status).toBe(201);
    const text = await res.text();
    expectNoSecrets(text, res);
    expect(IssueSuccessSchema.parse(JSON.parse(text))).toEqual({
      issueUrl: CREATED.html_url,
      number: 7,
    });
    expect(h.posts).toHaveLength(1);
    const call = h.posts[0];
    expect(call?.route).toBe("POST /repos/{owner}/{repo}/issues");
    expect(Object.keys(call?.params ?? {}).sort()).toEqual(["body", "owner", "repo", "title"]);
    expect(call?.params.owner).toBe("Octocat");
    expect(call?.params.repo).toBe("todo-app");
    expect(call?.params.title).toBe("Revive todo-app");
    expect(String(call?.params.body).endsWith(ISSUE_FOOTER)).toBe(true);
    expect(h.getCalls).toHaveLength(1);
    expect(h.getCalls[0]?.route).toBe("GET /repos/{owner}/{repo}");
    expect(h.getCalls[0]?.params).toEqual({ owner: "Octocat", repo: "todo-app" });
  });
});

describe("handleIssue demo mode", () => {
  it("returns 403 demo_mode with zero GitHub calls and no session read", async () => {
    const h = makeHarness();
    const res = await handleIssue(h.deps, post({ ...GOOD, demo: true }));
    await expectError(res, 403, "demo_mode");
    expect(h.getCalls).toHaveLength(0);
    expect(h.posts).toHaveLength(0);
    expect(h.sessionReads.count).toBe(0);
  });
});

describe("handleIssue invalid input", () => {
  const cases: [string, () => Request][] = [
    ["missing title", () => post({ repo: GOOD.repo, body: GOOD.body })],
    ["empty title", () => post({ ...GOOD, title: "" })],
    ["title over 100 code points", () => post({ ...GOOD, title: "a".repeat(101) })],
    ["title with newline", () => post({ ...GOOD, title: "a\nb" })],
    ["body over the cap", () => post({ ...GOOD, body: "a".repeat(4_001) })],
    ["demo as string", () => post({ ...GOOD, demo: "true" })],
    ["non-JSON", () => post("not json {")],
    ["wrong content type", () => post(GOOD, { "content-type": "text/plain" })],
  ];
  for (const [name, make] of cases) {
    it(`returns 400 for ${name} with zero GitHub calls`, async () => {
      const h = makeHarness();
      const res = await handleIssue(h.deps, make());
      await expectError(res, 400, "invalid_request");
      expect(h.getCalls).toHaveLength(0);
      expect(h.posts).toHaveLength(0);
      expect(h.sessionReads.count).toBe(0);
    });
  }
});

describe("handleIssue rejections", () => {
  it("returns unauthenticated without a session", async () => {
    const h = makeHarness({ session: null });
    await expectError(await handleIssue(h.deps, post(GOOD)), 401, "unauthenticated");
    expect(h.getCalls).toHaveLength(0);
    expect(h.posts).toHaveLength(0);
    expect(h.logs).toEqual([{ code: "unauthenticated", requestId: "req-1" }]);
  });

  it("rejects a foreign origin before reading the session", async () => {
    const h = makeHarness();
    const res = await handleIssue(h.deps, post(GOOD, { origin: "https://evil.example" }));
    await expectError(res, 403, "bad_origin");
    expect(h.sessionReads.count).toBe(0);
    expect(h.posts).toHaveLength(0);
  });

  it("rate limits per login with Retry-After", async () => {
    const h = makeHarness();
    for (let i = 0; i < ISSUE_LIMIT.limit; i += 1) {
      expect((await handleIssue(h.deps, post(GOOD))).status).toBe(201);
    }
    const res = await handleIssue(h.deps, post(GOOD));
    await expectError(res, 429, "issue_rate_limited");
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect(h.posts).toHaveLength(ISSUE_LIMIT.limit);
  });

  it("clears session cookies when the token is revoked", async () => {
    const h = makeHarness({ getError: new HttpError(401) });
    const res = await handleIssue(
      h.deps,
      post(GOOD, { cookie: "next-auth.session-token=abc" }),
    );
    await expectError(res, 401, "token_revoked");
    expect(res.headers.get("set-cookie") ?? "").toContain("next-auth.session-token=; Max-Age=0");
    expect(h.posts).toHaveLength(0);
  });

  it("maps a GitHub rate limit on the read", async () => {
    const h = makeHarness({
      getError: new HttpError(403, { headers: { "x-ratelimit-remaining": "0" } }),
    });
    await expectError(await handleIssue(h.deps, post(GOOD)), 429, "rate_limited");
    expect(h.posts).toHaveLength(0);
  });

  it("maps a GitHub 403 on the read", async () => {
    const h = makeHarness({ getError: new HttpError(403) });
    await expectError(await handleIssue(h.deps, post(GOOD)), 403, "forbidden");
    expect(h.posts).toHaveLength(0);
  });

  it("maps a missing repo", async () => {
    const h = makeHarness({ getError: new HttpError(404) });
    await expectError(await handleIssue(h.deps, post(GOOD)), 404, "repo_not_found");
    expect(h.posts).toHaveLength(0);
  });

  it("rejects when the repo owner is not the session login", async () => {
    const h = makeHarness({ meta: { ...META, owner: { login: "someone-else" } } });
    await expectError(await handleIssue(h.deps, post(GOOD)), 403, "not_repo_owner");
    expect(h.posts).toHaveLength(0);
  });

  it("rejects an archived repo", async () => {
    const h = makeHarness({ meta: { ...META, archived: true } });
    await expectError(await handleIssue(h.deps, post(GOOD)), 409, "repo_archived");
    expect(h.posts).toHaveLength(0);
  });

  it("rejects a repo with issues disabled", async () => {
    const h = makeHarness({ meta: { ...META, has_issues: false } });
    await expectError(await handleIssue(h.deps, post(GOOD)), 409, "issues_disabled");
    expect(h.posts).toHaveLength(0);
  });

  it("maps an invalid repo response", async () => {
    const h = makeHarness({ meta: { nope: true } });
    await expectError(await handleIssue(h.deps, post(GOOD)), 502, "invalid_github_response");
    expect(h.posts).toHaveLength(0);
  });
});

describe("handleIssue create failures", () => {
  it("maps 410 to issues_disabled", async () => {
    const h = makeHarness({ writeError: new HttpError(410) });
    await expectError(await handleIssue(h.deps, post(GOOD)), 409, "issues_disabled");
    expect(h.posts).toHaveLength(1);
  });

  it("maps 422 to issue_rejected", async () => {
    const h = makeHarness({
      writeError: new HttpError(422, { headers: {}, data: { message: UPSTREAM } }),
    });
    await expectError(await handleIssue(h.deps, post(GOOD)), 422, "issue_rejected");
    expect(h.posts).toHaveLength(1);
  });

  it("maps a timeout to github_unavailable with the check-the-list message", async () => {
    const h = makeHarness({ writeError: new Error(`timeout ${UPSTREAM} ${TOKEN}`) });
    const res = await handleIssue(h.deps, post(GOOD));
    expect(await res.clone().text()).toContain("issue list");
    await expectError(res, 502, "github_unavailable");
    expect(h.posts).toHaveLength(1);
  });

  it("maps a 503 to github_unavailable with the issue-list message", async () => {
    const h = makeHarness({ writeError: new HttpError(503) });
    const res = await handleIssue(h.deps, post(GOOD));
    expect(await res.clone().text()).toContain("issue list");
    await expectError(res, 502, "github_unavailable");
    expect(h.posts).toHaveLength(1);
  });

  it("maps an invalid create response to issue_result_unknown", async () => {
    const h = makeHarness({ writeData: { number: 7, html_url: "https://evil.example/x" } });
    await expectError(await handleIssue(h.deps, post(GOOD)), 502, "issue_result_unknown");
    expect(h.posts).toHaveLength(1);
  });
});
