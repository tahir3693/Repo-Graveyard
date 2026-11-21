import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/resurrection/deps", () => ({
  createResurrectionDeps: vi.fn(() => ({})),
}));
vi.mock("@/lib/resurrection/handle-resurrect", () => ({
  handleResurrect: vi.fn(async () => new Response(null, { status: 204 })),
}));

import * as route from "./route";

describe("resurrect route module", () => {
  it("exports exactly POST and maxDuration", () => {
    expect(Object.keys(route).sort()).toEqual(["POST", "maxDuration"]);
    expect(route.maxDuration).toBe(70);
  });

  it("exports no other HTTP methods", () => {
    for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
      expect(method in route).toBe(false);
    }
  });

  it("delegates POST to handleResurrect", async () => {
    const res = await route.POST(new Request("http://localhost/api/resurrect", { method: "POST" }));
    expect(res.status).toBe(204);
  });
});
