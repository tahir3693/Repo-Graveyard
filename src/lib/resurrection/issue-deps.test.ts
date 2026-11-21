import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/github/requester", () => ({
  createOctokitRequester: vi.fn(() => vi.fn()),
  readGitHubApiBaseUrl: vi.fn(() => "http://127.0.0.1:9999"),
}));
vi.mock("@/lib/github/issue-writer", () => ({ createIssueWriter: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/auth/token", () => ({ readUserToken: vi.fn(async () => null) }));

import { createIssueWriter } from "@/lib/github/issue-writer";
import { createOctokitRequester } from "@/lib/github/requester";

import { createIssueDeps } from "./issue-deps";

const KEY = "sk-test-secret-key-123";
const SECRET = "gh-secret-value-456";

describe("createIssueDeps", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes the token and base URL to the requester factory", () => {
    createIssueDeps({}).makeRequester("tok-1");
    expect(createOctokitRequester).toHaveBeenCalledWith("tok-1", "http://127.0.0.1:9999");
  });

  it("passes the token and base URL to the issue writer factory", () => {
    createIssueDeps({}).makeIssueWriter("tok-2");
    expect(createIssueWriter).toHaveBeenCalledWith("tok-2", "http://127.0.0.1:9999");
  });

  it("takes app origins from NEXTAUTH_URL", () => {
    expect(createIssueDeps({ NEXTAUTH_URL: "https://grave.example/x" }).config.appOrigins).toEqual([
      "https://grave.example",
    ]);
  });

  it("logs only code and requestId", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const entry = { code: "internal_error", requestId: "r1", token: SECRET, extra: 1 };
    createIssueDeps({}).log(entry);
    expect(warn).toHaveBeenCalledWith({ code: "internal_error", requestId: "r1" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(SECRET);
  });

  it("does not contain any secret when serialized", () => {
    const deps = createIssueDeps({
      LLM_API_KEY: KEY,
      GITHUB_SECRET: SECRET,
      AUTH_SECRET: SECRET,
      GITHUB_DEMO_TOKEN: SECRET,
    });
    const text = JSON.stringify(deps);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain(SECRET);
  });
});
