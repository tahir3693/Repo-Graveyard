import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/token", () => ({ readUserToken: vi.fn() }));
vi.mock("@/lib/github/requester", () => ({ createOctokitRequester: vi.fn() }));

import * as route from "./route";

describe("scan route module", () => {
  it("exports POST", () => {
    expect(typeof route.POST).toBe("function");
  });

  it("exports no other HTTP method", () => {
    const exported = Object.keys(route);
    for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
      expect(exported).not.toContain(method);
    }
    expect(exported).toEqual(["POST"]);
  });
});
