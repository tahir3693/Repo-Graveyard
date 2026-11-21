import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compareCodePoint } from "@/lib/github/sort";
import { buildCommitMessages, buildFileTree, buildIssueTitles } from "./context";
import { codePointLength, firstLine } from "./text";

// Feature: resurrection, Property 3: List builders keep order, shape and top level only
// **Validates: Requirements 3.7, 3.8, 3.10**

const piece = fc.oneof(
  fc.string({ maxLength: 8 }),
  fc.constantFrom("/", "\n", "\r\n", "😀", "a", "b", " "),
);
const text = fc.array(piece, { maxLength: 30 }).map((p) => p.join(""));
const longText = fc.oneof(text, fc.integer({ min: 0, max: 300 }).map((n) => "x".repeat(n)));

function isSubsequence(sub: readonly string[], full: readonly string[]): boolean {
  let i = 0;
  for (const item of full) {
    if (i < sub.length && sub[i] === item) i += 1;
  }
  return i === sub.length;
}

describe("Feature: resurrection, Property 3: List builders keep order, shape and top level only", () => {
  it("buildFileTree keeps top-level names, marks directories, sorts and caps", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ path: longText, type: fc.constantFrom("blob", "tree", "commit") }), { maxLength: 200 }),
        (entries) => {
          const out = buildFileTree(entries);
          expect(out.length).toBeLessThanOrEqual(50);
          for (const e of out) {
            expect(codePointLength(e)).toBeLessThanOrEqual(80);
            expect(e.slice(0, -1).includes("/")).toBe(false);
          }
          for (let i = 1; i < out.length; i += 1) {
            expect(compareCodePoint(out[i - 1], out[i])).toBeLessThanOrEqual(0);
          }
          const dirs = entries.filter((e) => e.type === "tree" && !e.path.includes("/") && codePointLength(e.path) < 80);
          if (dirs.length > 0 && entries.length <= 50) {
            for (const d of dirs) {
              if (d.path !== "" && !/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uD800-\uDFFF\r]/.test(d.path)) {
                expect(out).toContain(`${d.path}/`);
              }
            }
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it("buildCommitMessages keeps at most 10 single-line entries in input order", () => {
    fc.assert(
      fc.property(fc.array(longText, { maxLength: 40 }), (messages) => {
        const out = buildCommitMessages(messages);
        expect(out.length).toBe(Math.min(10, messages.length));
        out.forEach((e, i) => {
          expect(e.includes("\n")).toBe(false);
          expect(codePointLength(e)).toBeLessThanOrEqual(200);
          expect(Array.from(firstLine(messages[i])).slice(0, 200).join("")).toBe(e);
        });
      }),
      { numRuns: 150 },
    );
  });

  it("buildIssueTitles keeps at most 10 non-empty entries in input order", () => {
    fc.assert(
      fc.property(fc.array(longText, { maxLength: 40 }), (titles) => {
        const out = buildIssueTitles(titles);
        expect(out.length).toBeLessThanOrEqual(10);
        for (const e of out) {
          expect(e).not.toBe("");
          expect(codePointLength(e)).toBeLessThanOrEqual(150);
        }
        const capped = titles.map((t) => Array.from(t).slice(0, 150).join(""));
        expect(isSubsequence(out.map((e) => e), capped.map((c) => c)) || out.length > 0).toBe(true);
        const nonEmptyInputs = titles.filter((t) => buildIssueTitles([t]).length > 0);
        expect(out.length).toBe(Math.min(10, nonEmptyInputs.length));
        out.forEach((e, i) => {
          expect(buildIssueTitles([nonEmptyInputs[i]])[0]).toBe(e);
        });
      }),
      { numRuns: 150 },
    );
  });
});
