import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { IssueRequestSchema, ResurrectRequestSchema } from "./request";

// Feature: resurrection, Property 14: Request schemas ignore unknown fields and reject bad names
// **Validates: Requirements 1.1, 1.2, 10.1**

const NAME = /^[A-Za-z0-9._-]{1,100}$/;
const isValidName = (s: string) => NAME.test(s) && s !== "." && s !== "..";

describe("Feature: resurrection, Property 14: Request schemas ignore unknown fields and reject bad names", () => {
  it("returns only allowed keys and accepts exactly valid names", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string({ maxLength: 12 }), fc.stringMatching(/^[A-Za-z0-9._-]{1,12}$/)),
        fc.dictionary(
          fc.constantFrom("owner", "username", "labels", "assignees", "x", "repo", "demo"),
          fc.jsonValue(),
        ),
        (name, extras) => {
          const input = { ...extras, repo: name };
          const r = ResurrectRequestSchema.safeParse(input);
          if (r.success) expect(Object.keys(r.data).every((k) => k === "repo" || k === "demo")).toBe(true);
          const demoOk = extras.demo === undefined || typeof extras.demo === "boolean";
          expect(r.success).toBe(isValidName(name) && demoOk);

          const i = IssueRequestSchema.safeParse({ ...input, title: "t", body: "b" });
          if (i.success) {
            expect(Object.keys(i.data).every((k) => ["repo", "demo", "title", "body"].includes(k))).toBe(
              true,
            );
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("rejects non-boolean demo", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
        (demo) => {
          expect(ResurrectRequestSchema.safeParse({ repo: "ok", demo }).success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
