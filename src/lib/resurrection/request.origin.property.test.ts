import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./request";

// Feature: resurrection, Property 15: Origin check
// **Validates: Requirements 1.4, 10.3**

describe("Feature: resurrection, Property 15: Origin check", () => {
  it("allows only an absent header or an exact match", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ maxLength: 20 }), { nil: null }),
        fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
        (header, allowed) => {
          const expected = header === null || allowed.includes(header);
          expect(isAllowedOrigin(header, allowed)).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("matches an allowed value picked from the list", () => {
    fc.assert(
      fc.property(fc.array(fc.webUrl(), { minLength: 1, maxLength: 5 }), (allowed) => {
        expect(isAllowedOrigin(allowed[0] ?? "", allowed)).toBe(true);
        expect(isAllowedOrigin("null", allowed)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
