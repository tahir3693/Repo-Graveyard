import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { sanitizePlanText } from "./plan";

// Feature: resurrection, Property 8: sanitizePlanText is total, idempotent and removes risky markup
// **Validates: Requirements 6.9, 6.10**

const piece = fc.oneof(
  fc.string({ unit: "binary", maxLength: 6 }),
  fc.constantFrom(
    "<", ">", "<b>", "</i>", "![", "](", ")", "!", "[", "]", "`", "``", "@", "@user", "@a-b", "@@x", "a@b.com",
    "\n", "\r", "\u0000", "\u202E", "\uD800", " ", "x", "![a](b)", "<a href=\"x\">",
  ),
);
const anyText = fc.array(piece, { maxLength: 40 }).map((p) => p.join(""));

const CONTROL = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/;

describe("Feature: resurrection, Property 8: sanitizePlanText is total, idempotent and removes risky markup", () => {
  it("is idempotent and leaves no controls, tags, images or bare mentions", () => {
    fc.assert(
      fc.property(anyText, (input) => {
        const out = sanitizePlanText(input);
        expect(sanitizePlanText(out)).toBe(out);
        expect(CONTROL.test(out)).toBe(false);
        expect(/<[^>]*>/.test(out)).toBe(false);
        expect(out.includes("![")).toBe(false);
        const parts = out.split("`");
        expect(parts.length % 2).toBe(1);
        parts.forEach((part, i) => {
          if (i % 2 === 0) expect(/@[A-Za-z0-9]/.test(part)).toBe(false);
        });
      }),
      { numRuns: 500 },
    );
  });
});
