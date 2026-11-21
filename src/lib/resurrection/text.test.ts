import { describe, expect, it } from "vitest";
import { RESURRECTION_LIMITS } from "./limits";
import { capText, codePointLength, firstLine, sanitizeText } from "./text";

describe("capText", () => {
  const cap = RESURRECTION_LIMITS.CAP_README;

  it("keeps text of exactly 6,000 code points", () => {
    const text = "a".repeat(cap);
    expect(capText(text, cap)).toBe(text);
  });

  it("cuts text of 6,001 code points to 6,000", () => {
    const out = capText("a".repeat(cap + 1), cap);
    expect(codePointLength(out)).toBe(cap);
  });

  it("never splits a surrogate pair", () => {
    expect(capText("a😀b", 2)).toBe("a😀");
    expect(capText("😀😀", 1)).toBe("😀");
  });

  it("replaces a lone surrogate with U+FFFD", () => {
    expect(capText("a\uD800b", 10)).toBe("a\uFFFDb");
    expect(capText("a\uDC00", 10)).toBe("a\uFFFD");
  });

  it("removes bidi overrides and control characters but keeps newline and tab", () => {
    expect(capText("a\u202Eb\u2066c\u0000d\ne\tf", 50)).toBe("abcd\ne\tf");
  });

  it("returns an empty string for non-strings", () => {
    expect(capText(null, 5)).toBe("");
    expect(capText(undefined, 5)).toBe("");
    expect(capText(42, 5)).toBe("");
    expect(capText({}, 5)).toBe("");
  });

  it("treats an invalid maxChars as 0", () => {
    expect(capText("abc", -1)).toBe("");
    expect(capText("abc", Number.NaN)).toBe("");
    expect(capText("abc", 1.5)).toBe("");
  });
});

describe("sanitizeText", () => {
  it("normalizes line endings", () => {
    expect(sanitizeText("a\r\nb\rc")).toBe("a\nb\nc");
  });
});

describe("firstLine", () => {
  it("returns the text before the first newline", () => {
    expect(firstLine("fix: thing\n\nbody")).toBe("fix: thing");
    expect(firstLine("single")).toBe("single");
    expect(firstLine("a\r\nb")).toBe("a");
  });
});
