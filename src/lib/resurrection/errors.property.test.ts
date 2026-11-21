import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RESURRECTION_ERROR_TABLE, mapGitHubFailure, toSafeError } from "./errors";

// Feature: resurrection, Property 18: Safe errors never carry upstream text
// **Validates: Requirements 2.7, 2.8, 2.9, 2.10, 9.7, 9.8, 11.8, 15.6**

const marker = fc.stringMatching(/^[A-Za-z0-9]{12,24}$/).map((s) => `SECRET${s}`);

describe("Feature: resurrection, Property 18: Safe errors never carry upstream text", () => {
  it("maps any thrown value to a table code with a table message and no embedded text", async () => {
    await fc.assert(
      fc.asyncProperty(
        marker,
        marker,
        marker,
        marker,
        fc.option(fc.constantFrom(401, 403, 404, 410, 422, 429, 500, 502), { nil: undefined }),
        fc.constantFrom("user", "demo"),
        fc.constantFrom("read", "issue-create"),
        async (m1, m2, m3, m4, status, mode, phase) => {
          const thrown = {
            status,
            message: m1,
            stack: m2,
            response: { headers: { "x-ratelimit-remaining": "0", authorization: m3, "set-cookie": m4 } },
          };
          const failure = mapGitHubFailure(thrown, { now: new Date(0), mode, phase });
          expect(Object.keys(RESURRECTION_ERROR_TABLE)).toContain(failure.code);
          const res = toSafeError(failure.code, {
            ...(failure.resetAt === undefined ? {} : { resetAt: failure.resetAt }),
            ...(failure.message === undefined ? {} : { message: failure.message }),
          });
          const entry = RESURRECTION_ERROR_TABLE[failure.code];
          expect(res.status).toBe(entry.status);
          const text = await res.text();
          const body: unknown = JSON.parse(text);
          expect(body).toMatchObject({ error: { code: failure.code } });
          for (const m of [m1, m2, m3, m4]) {
            expect(text).not.toContain(m);
            expect(JSON.stringify([...res.headers])).not.toContain(m);
          }
          const message = (body as { error: { message: string } }).error.message;
          expect(message.length).toBeLessThanOrEqual(140);
        },
      ),
      { numRuns: 150 },
    );
  });
});
