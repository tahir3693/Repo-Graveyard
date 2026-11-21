import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import type { GitHubResponse } from "@/lib/github/requester";
import { isReadRoute, readOnly } from "./read-only";

// Feature: resurrection, Property 17: Read-only guard
// **Validates: Requirements 1.8, 1.9**

const okResponse: GitHubResponse = { status: 200, headers: {}, data: null };

const routeArb = fc.oneof(
  fc.string({ maxLength: 40 }),
  fc.string({ maxLength: 30 }).map((s) => `GET ${s}`),
  fc.string({ maxLength: 30 }).map((s) => `get ${s}`),
  fc.string({ maxLength: 30 }).map((s) => ` GET ${s}`),
  fc.string({ maxLength: 30 }).map((s) => `GET${s}`),
  fc.constantFrom("POST /repos/{owner}/{repo}/issues", "PATCH /x", "DELETE /x", "PUT /x", "", "GET"),
);

describe("Feature: resurrection, Property 17: Read-only guard", () => {
  it("isReadRoute is true if and only if the route starts with 'GET '", () => {
    fc.assert(
      fc.property(routeArb, (route) => {
        expect(isReadRoute(route)).toBe(route.startsWith("GET "));
      }),
      { numRuns: 200 },
    );
  });

  it("readOnly calls the inner requester only for GET routes and throws before it otherwise", async () => {
    await fc.assert(
      fc.asyncProperty(routeArb, async (route) => {
        const inner = vi.fn(async () => okResponse);
        const guarded = readOnly(inner);
        if (route.startsWith("GET ")) {
          await expect(guarded(route as `GET ${string}`, {})).resolves.toBe(okResponse);
          expect(inner).toHaveBeenCalledTimes(1);
        } else {
          // Cast only to reach the runtime guard with a non-GET string.
          expect(() => guarded(route as `GET ${string}`, {})).toThrow("read-only requester");
          expect(inner).not.toHaveBeenCalled();
        }
      }),
      { numRuns: 200 },
    );
  });
});
