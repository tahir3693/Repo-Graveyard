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

import { createIssueWriter, ISSUE_WRITE_ROUTE } from "./issue-writer";

const GOOD = { owner: "o", repo: "r", title: "t", body: "b" };

beforeEach(() => {
  mocks.constructorOptions.length = 0;
  mocks.request.mockReset();
  mocks.wrap.mockReset();
});

describe("createIssueWriter", () => {
  it("configures Octokit like the read requester", () => {
    createIssueWriter("tok", "http://127.0.0.1:3101");
    const options = mocks.constructorOptions[0] as Record<string, unknown>;
    expect(options.auth).toBe("tok");
    expect(options.baseUrl).toBe("http://127.0.0.1:3101");
    expect(options.throttle).toEqual({ enabled: false });
    expect(options.retry).toEqual({ enabled: false });
    const log = options.log as Record<string, () => unknown>;
    for (const level of ["debug", "info", "warn", "error"]) {
      expect(log[level]()).toBeUndefined();
    }
  });

  it("omits baseUrl when not given and adds an abort signal", async () => {
    createIssueWriter("tok");
    expect("baseUrl" in (mocks.constructorOptions[0] as object)).toBe(false);
    const wrapper = mocks.wrap.mock.calls[0][1];
    const inner = vi.fn().mockResolvedValue("ok");
    await wrapper(inner, { method: "POST", request: {} });
    expect(inner.mock.calls[0][0].request.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends the allowed route with exactly four params", async () => {
    mocks.request.mockResolvedValue({
      status: 201,
      headers: { "X-Test": 1 },
      data: { number: 1 },
    });
    const response = await createIssueWriter("tok")(ISSUE_WRITE_ROUTE, GOOD);
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledWith(ISSUE_WRITE_ROUTE, GOOD);
    expect(response).toEqual({ status: 201, headers: { "x-test": "1" }, data: { number: 1 } });
  });

  it.each([
    "POST /repos/{owner}/{repo}/pulls",
    "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
    "DELETE /repos/{owner}/{repo}",
    "GET /repos/{owner}/{repo}/issues",
    "post /repos/{owner}/{repo}/issues",
  ])("throws before sending for route %s", async (route) => {
    await expect(createIssueWriter("tok")(route, GOOD)).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it.each([
    { ...GOOD, labels: ["bug"] },
    { ...GOOD, assignees: ["x"] },
    { owner: "o", repo: "r", title: "t" },
    { ...GOOD, body: 5 },
  ])("throws before sending for params %j", async (params) => {
    await expect(createIssueWriter("tok")(ISSUE_WRITE_ROUTE, params)).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("rejects when Octokit rejects for a non-2xx response", async () => {
    mocks.request.mockRejectedValue(Object.assign(new Error("Gone"), { status: 410 }));
    await expect(createIssueWriter("tok")(ISSUE_WRITE_ROUTE, GOOD)).rejects.toMatchObject({
      status: 410,
    });
  });

  it("does not put the token in thrown errors", async () => {
    const error = await createIssueWriter("secret-token")("GET /x", {}).catch((e: unknown) => e);
    expect(String(error)).not.toContain("secret-token");
  });
});
