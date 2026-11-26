import { describe, expect, it, vi } from "vitest";
import { ScanFailureError } from "../github/errors";
import type { GitHubRequester } from "../github/requester";
import { scanAccount } from "../github/scan";
import { createScanCache } from "./cache";
import { handleScan, type ScanDeps } from "./handler";
import { ERROR_TABLE, SafeErrorSchema, ScanSuccessSchema } from "./response";

const NOW = new Date("2025-06-01T00:00:00.000Z");
const AUTH_ENV = { GITHUB_ID: "id", GITHUB_SECRET: "secret", AUTH_SECRET: "auth" };
const USER_TOKEN = "gho_user_secret_token";

function repoPayload(name: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name,
    html_url: `https://github.com/octo/${name}`,
    description: null,
    fork: false,
    archived: false,
    stargazers_count: 1,
    open_issues_count: 0,
    language: "TypeScript",
    pushed_at: "2025-05-01T00:00:00Z",
    default_branch: "main",
    owner: { login: "octo" },
    ...over,
  };
}

/** A repo entry whose fields come back null, as a half-deleted or odd repo can. */
const NULL_FIELDS = repoPayload("nullish", {
  name: null,
  html_url: null,
  stargazers_count: null,
  open_issues_count: null,
  default_branch: null,
  owner: null,
});

/** A repo entry with no default branch at all. */
function noDefaultBranch(): Record<string, unknown> {
  const entry = repoPayload("branchless");
  delete entry.default_branch;
  return entry;
}

type FakeOpts = {
  list: unknown[];
  /** Repos with no commits: GitHub answers 409 to the commit list. */
  empty?: Set<string>;
  /** Repos whose check-runs answer has an unexpected shape. */
  badChecks?: Set<string>;
  /** Repos that answer 401 on the check-runs call. */
  revoked?: Set<string>;
};

function fakeGitHub(opts: FakeOpts): { requester: GitHubRequester; calls: string[] } {
  const calls: string[] = [];
  const requester: GitHubRequester = async (route, params) => {
    calls.push(route);
    const repo = String(params.repo);
    if (route === "GET /user/repos") return { status: 200, headers: {}, data: opts.list };
    if (route.endsWith("/commits")) {
      if (opts.empty?.has(repo)) {
        throw { status: 409, message: "Git Repository is empty.", response: { headers: {} } };
      }
      const date = params.path === "package.json" ? "2025-05-01T00:00:00Z" : "2025-05-20T00:00:00Z";
      return { status: 200, headers: {}, data: [{ commit: { committer: { date } } }] };
    }
    if (route.endsWith("/check-runs")) {
      if (opts.revoked?.has(repo)) throw { status: 401, message: "Bad credentials", response: { headers: {} } };
      if (opts.badChecks?.has(repo)) return { status: 200, headers: {}, data: { nope: 1 } };
      return { status: 200, headers: {}, data: { total_count: 1, check_runs: [{ conclusion: "success" }] } };
    }
    if (route.endsWith("/readme")) return { status: 200, headers: {}, data: { name: "README.md" } };
    throw { status: 404, message: "Not Found", response: { headers: {} } };
  };
  return { requester, calls };
}

function deps(opts: FakeOpts) {
  const fake = fakeGitHub(opts);
  const log = vi.fn();
  const scanDeps: ScanDeps = {
    now: () => NOW,
    env: AUTH_ENV,
    cache: createScanCache(),
    makeRequester: () => fake.requester,
    readUserToken: async () => ({ login: "Octo", accessToken: USER_TOKEN }),
    log,
  };
  return { scanDeps, fake, log };
}

function post(): Request {
  return new Request("http://localhost/api/scan", { method: "POST", body: JSON.stringify({}) });
}

describe("signed-in scan with unreadable repos", () => {
  const mixed: FakeOpts = {
    list: [
      repoPayload("alpha"),
      NULL_FIELDS,
      noDefaultBranch(),
      repoPayload("hollow", { pushed_at: null }),
      repoPayload("old", { archived: true }),
      repoPayload("weird"),
    ],
    empty: new Set(["hollow"]),
    badChecks: new Set(["weird"]),
  };

  it("returns the good repos plus the count of repos that could not be read", async () => {
    const h = deps(mixed);
    const res = await handleScan(h.scanDeps, post());
    expect(res.status).toBe(200);
    const body = ScanSuccessSchema.parse(await res.json());
    expect(body.repos.map((r) => r.name)).toEqual(["alpha", "hollow", "old"]);
    // Null fields and no default branch are skipped from the list. "weird" is skipped at its details.
    expect(body.skippedInvalid).toBe(3);
    expect(body.code).toBeUndefined();
  });

  it("keeps an empty repo, with no last commit", async () => {
    const body = ScanSuccessSchema.parse(await (await handleScan(deps(mixed).scanDeps, post())).json());
    const hollow = body.repos.find((r) => r.name === "hollow");
    expect(hollow).toMatchObject({ lastCommitAt: null, ciStatus: "none", hasReadme: false });
  });

  it("keeps an archived repo, marked archived", async () => {
    const body = ScanSuccessSchema.parse(await (await handleScan(deps(mixed).scanDeps, post())).json());
    expect(body.repos.find((r) => r.name === "old")?.archived).toBe(true);
  });

  it("logs one repos_skipped line with a redacted reason, and nothing from GitHub's body", async () => {
    const h = deps(mixed);
    await handleScan(h.scanDeps, post());
    const skipped = h.log.mock.calls.map((c) => c[0]).filter((e) => e.code === "repos_skipped");
    expect(skipped).toHaveLength(1);
    expect(skipped[0]).toMatchObject({ step: "fetch-details", errorName: "Error" });
    // ScanFailureError builds its message from the failure kind only, so it is safe to log.
    expect(skipped[0].message).toBe("1 skipped. First: Scan failed: invalid_response");
    expect(Object.keys(skipped[0]).sort()).toEqual(["code", "errorName", "message", "requestId", "step"]);
  });

  it("reports zero skipped for a clean account and logs nothing extra", async () => {
    const h = deps({ list: [repoPayload("alpha"), repoPayload("beta")] });
    const body = ScanSuccessSchema.parse(await (await handleScan(h.scanDeps, post())).json());
    expect(body.skippedInvalid).toBe(0);
    expect(h.log).not.toHaveBeenCalled();
  });

  it("still fails the whole scan when the token is revoked partway through", async () => {
    const h = deps({ list: [repoPayload("alpha"), repoPayload("beta")], revoked: new Set(["beta"]) });
    const res = await handleScan(h.scanDeps, post());
    expect(res.status).toBe(ERROR_TABLE.token_revoked.status);
    expect(SafeErrorSchema.parse(await res.json()).error.code).toBe("token_revoked");
  });

  it("fails with invalid_github_response when every repo is unreadable", async () => {
    const h = deps({ list: [repoPayload("a"), repoPayload("b")], badChecks: new Set(["a", "b"]) });
    const res = await handleScan(h.scanDeps, post());
    expect(res.status).toBe(ERROR_TABLE.invalid_github_response.status);
    expect(SafeErrorSchema.parse(await res.json()).error.code).toBe("invalid_github_response");
  });
});

describe("scanAccount with unreadable repos", () => {
  it("reports each skipped repo through onSkip and the stage through onStep", async () => {
    const fake = fakeGitHub({
      list: [repoPayload("alpha"), repoPayload("weird")],
      badChecks: new Set(["weird"]),
    });
    const onSkip = vi.fn();
    const steps: string[] = [];
    const data = await scanAccount(
      { request: fake.requester, now: NOW, onSkip, onStep: (s) => steps.push(s) },
      { kind: "user" },
      false,
    );
    expect(data.repos.map((r) => r.name)).toEqual(["alpha"]);
    expect(data.skippedInvalid).toBe(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSkip.mock.calls[0]?.[0]).toBeInstanceOf(ScanFailureError);
    expect(steps).toEqual(["list-repos", "fetch-details"]);
  });

  it("adds list entries that cannot be parsed to the same count", async () => {
    const fake = fakeGitHub({ list: [repoPayload("alpha"), NULL_FIELDS, noDefaultBranch()] });
    const data = await scanAccount({ request: fake.requester, now: NOW }, { kind: "user" }, false);
    expect(data.repos.map((r) => r.name)).toEqual(["alpha"]);
    expect(data.skippedInvalid).toBe(2);
  });

  it("skips a repo whose handling throws something unexpected, instead of failing the scan", async () => {
    const fake = fakeGitHub({ list: [repoPayload("alpha"), repoPayload("beta")] });
    const flaky: GitHubRequester = async (route, params) => {
      if (route.endsWith("/readme") && params.repo === "beta") {
        // A payload whose getter throws: it reaches Zod, which cannot read it.
        return {
          status: 200,
          headers: {},
          data: new Proxy({}, { get: () => { throw new TypeError("poisoned payload"); } }),
        };
      }
      return fake.requester(route, params);
    };
    const onSkip = vi.fn();
    const data = await scanAccount({ request: flaky, now: NOW, onSkip }, { kind: "user" }, false);
    expect(data.repos.map((r) => r.name)).toEqual(["alpha"]);
    expect(data.skippedInvalid).toBe(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
