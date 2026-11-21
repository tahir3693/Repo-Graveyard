import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { capText, codePointLength, sanitizeText } from "./text";

// Feature: resurrection, Property 1: capText bounds, cleanliness and idempotence
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

const unit = fc.oneof(
  fc.string({ unit: "binary", maxLength: 1 }),
  fc.constantFrom("\u0000", "\r", "\n", "\t", "\u202A", "\u202E", "\u2066", "\u2069", "\uD800", "\uDFFF", "😀", "\u200B"),
);
const anyText = fc.array(unit, { maxLength: 400 }).map((parts) => parts.join(""));

const FORBIDDEN_CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/;
const BIDI = /[\u202A-\u202E\u2066-\u2069]/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe("Feature: resurrection, Property 1: capText bounds, cleanliness and idempotence", () => {
  it("bounds length, removes risky characters, equals the cut of sanitizeText and is idempotent", () => {
    fc.assert(
      fc.property(anyText, fc.integer({ min: 0, max: 10_000 }), (input, max) => {
        const out = capText(input, max);
        expect(codePointLength(out)).toBeLessThanOrEqual(max);
        expect(FORBIDDEN_CONTROL.test(out)).toBe(false);
        expect(BIDI.test(out)).toBe(false);
        expect(LONE_SURROGATE.test(out)).toBe(false);
        expect(out).toBe(Array.from(sanitizeText(input)).slice(0, max).join(""));
        expect(capText(out, max)).toBe(out);
      }),
      { numRuns: 200 },
    );
  });

  it("returns an empty string for any non-string input", () => {
    fc.assert(
      fc.property(
        fc.anything().filter((v) => typeof v !== "string"),
        fc.integer({ min: 0, max: 100 }),
        (value, max) => {
          expect(capText(value, max)).toBe("");
        },
      ),
      { numRuns: 100 },
    );
  });
});
