import { describe, expect, it, vi } from "vitest";

import type { GitHubRequester } from "@/lib/github/requester";

import { isReadRoute, readOnly } from "./read-only";

function makeInner() {
  return vi.fn<GitHubRequester>(async () => ({ status: 200, headers: {}, data: { ok: true } }));
}

describe("isReadRoute", () => {
  it("accepts only strings that start with 'GET '", () => {
    expect(isReadRoute("GET /repos/{owner}/{repo}")).toBe(true);
    expect(isReadRoute("POST /repos/{owner}/{repo}/issues")).toBe(false);
    expect(isReadRoute("get /repos")).toBe(false);
    expect(isReadRoute("GET")).toBe(false);
    expect(isReadRoute("")).toBe(false);
  });
});

describe("readOnly", () => {
  it("forwards GET routes to the inner requester", async () => {
    const inner = makeInner();
    const response = await readOnly(inner)("GET /repos/{owner}/{repo}", { owner: "a", repo: "b" });
    expect(response.status).toBe(200);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledWith("GET /repos/{owner}/{repo}", { owner: "a", repo: "b" });
  });

  it.each(["POST", "PATCH", "DELETE", "PUT"])(
    "throws for %s without calling the inner requester",
    (method) => {
      const inner = makeInner();
      const request = readOnly(inner);
      // Simulates a coding mistake that bypasses the compile-time route type.
      expect(() =>
        Reflect.apply(request, undefined, [`${method} /repos/{owner}/{repo}/issues`, {}]),
      ).toThrow(
        "read-only requester",
      );
      expect(inner).not.toHaveBeenCalled();
    },
  );
});
