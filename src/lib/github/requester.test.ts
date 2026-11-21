import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructorOptions: [] as unknown[],
  request: vi.fn(),
  wrap: vi.fn(),
}));

vi.mock("octokit", () => ({
  Octokit: class {
    hook = { wrap: mocks.wrap };
    request = mocks.request;
    constructor(options: unknown) {
      mocks.constructorOptions.push(options);
    }
  },
}));

import { createOctokitRequester, readGitHubApiBaseUrl } from "./requester";

describe("readGitHubApiBaseUrl", () => {
  it("returns a valid http(s) URL without trailing slashes", () => {
    expect(readGitHubApiBaseUrl({ GITHUB_API_BASE_URL: " http://127.0.0.1:3101/ " })).toBe(
      "http://127.0.0.1:3101",
    );
  });

  it("returns null when missing, empty, not a URL or not http(s)", () => {
    expect(readGitHubApiBaseUrl({})).toBeNull();
    expect(readGitHubApiBaseUrl({ GITHUB_API_BASE_URL: "  " })).toBeNull();
    expect(readGitHubApiBaseUrl({ GITHUB_API_BASE_URL: "not a url" })).toBeNull();
    expect(readGitHubApiBaseUrl({ GITHUB_API_BASE_URL: "file:///etc/passwd" })).toBeNull();
  });

  it("accepts only loopback hosts, so a token can never leave the machine", () => {
    expect(readGitHubApiBaseUrl({ GITHUB_API_BASE_URL: "http://localhost:3101" })).toBe(
      "http://localhost:3101",
    );
    expect(readGitHubApiBaseUrl({ GITHUB_API_BASE_URL: "http://[::1]:3101" })).toBe(
      "http://[::1]:3101",
    );
    for (const url of [
      "https://attacker.example",
      "https://api.github.com.attacker.example",
      "http://127.0.0.1.attacker.example",
      "http://10.0.0.5:3101",
      "http://user:pw@evil.example@127.0.0.1",
    ]) {
      expect(readGitHubApiBaseUrl({ GITHUB_API_BASE_URL: url }), url).toBeNull();
    }
  });

  it("is ignored on Vercel production even for a loopback URL", () => {
    expect(
      readGitHubApiBaseUrl({ GITHUB_API_BASE_URL: "http://127.0.0.1:3101", VERCEL_ENV: "production" }),
    ).toBeNull();
  });
});

beforeEach(() => {
  mocks.constructorOptions.length = 0;
  mocks.request.mockReset();
  mocks.wrap.mockReset();
});

describe("createOctokitRequester", () => {
  it("sets no auth when the token is null", () => {
    createOctokitRequester(null);
    const options = mocks.constructorOptions[0] as Record<string, unknown>;
    expect("auth" in options).toBe(false);
  });

  it("passes baseUrl to Octokit only when given", () => {
    createOctokitRequester(null);
    createOctokitRequester(null, "http://127.0.0.1:3101");
    expect("baseUrl" in (mocks.constructorOptions[0] as object)).toBe(false);
    expect((mocks.constructorOptions[1] as Record<string, unknown>).baseUrl).toBe(
      "http://127.0.0.1:3101",
    );
  });

  it("sets auth when a token is passed and disables throttle, retry and logging", () => {
    createOctokitRequester("tok");
    const options = mocks.constructorOptions[0] as Record<string, unknown>;
    expect(options.auth).toBe("tok");
    expect(options.throttle).toEqual({ enabled: false });
    expect(options.retry).toEqual({ enabled: false });
    const log = options.log as Record<string, () => unknown>;
    for (const level of ["debug", "info", "warn", "error"]) {
      expect(log[level]()).toBeUndefined();
    }
  });

  it("attaches a per-request abort signal through hook.wrap", async () => {
    createOctokitRequester(null);
    expect(mocks.wrap).toHaveBeenCalledTimes(1);
    expect(mocks.wrap.mock.calls[0][0]).toBe("request");
    const wrapper = mocks.wrap.mock.calls[0][1];
    const inner = vi.fn().mockResolvedValue("ok");
    await wrapper(inner, { method: "GET", request: { foo: 1 } });
    const passed = inner.mock.calls[0][0];
    expect(passed.request.signal).toBeInstanceOf(AbortSignal);
    expect(passed.request.foo).toBe(1);
    expect(passed.method).toBe("GET");
  });

  it("returns status, lowercased string headers and unknown data", async () => {
    mocks.request.mockResolvedValue({
      status: 200,
      headers: { Link: "next", "x-ratelimit-remaining": 5 },
      data: { a: 1 },
    });
    const response = await createOctokitRequester(null)("GET /user/repos", { per_page: 100 });
    expect(mocks.request).toHaveBeenCalledWith("GET /user/repos", { per_page: 100 });
    expect(response).toEqual({
      status: 200,
      headers: { link: "next", "x-ratelimit-remaining": "5" },
      data: { a: 1 },
    });
  });

  it("rejects when Octokit throws for a non-2xx response", async () => {
    mocks.request.mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));
    await expect(createOctokitRequester(null)("GET /repos/a/b", {})).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects non-GET routes before sending", async () => {
    const requester = createOctokitRequester("tok");
    await expect(requester("POST /repos/a/b/issues", {})).rejects.toThrow();
    await expect(requester("DELETE /repos/a/b", {})).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
