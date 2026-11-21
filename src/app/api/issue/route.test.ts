import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/github/requester", () => ({
  createOctokitRequester: vi.fn(() => vi.fn()),
  readGitHubApiBaseUrl: vi.fn(() => null),
}));
vi.mock("@/lib/github/issue-writer", () => ({ createIssueWriter: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/auth/token", () => ({
  readUserToken: vi.fn(async () => ({ login: "octo", accessToken: "tok" })),
}));

import { readUserToken } from "@/lib/auth/token";
import { createIssueWriter } from "@/lib/github/issue-writer";
import { createOctokitRequester } from "@/lib/github/requester";

import * as route from "./route";

describe("issue route module", () => {
  it("exports exactly POST and maxDuration", () => {
    expect(Object.keys(route).sort()).toEqual(["POST", "maxDuration"]);
    expect(route.maxDuration).toBe(30);
  });

  it("exports no other HTTP methods", () => {
    for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
      expect(method in route).toBe(false);
    }
  });

  it("rejects demo requests with 403 demo_mode and makes no GitHub calls", async () => {
    const res = await route.POST(
      new Request("http://localhost/api/issue", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ repo: "octo-repo", title: "Revive", body: "Plan", demo: true }),
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "demo_mode" } });
    expect(createOctokitRequester).not.toHaveBeenCalled();
    expect(createIssueWriter).not.toHaveBeenCalled();
    expect(readUserToken).not.toHaveBeenCalled();
  });
});
