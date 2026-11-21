import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compareCodePoint, sortByName } from "./sort";

describe("compareCodePoint", () => {
  it("is case-sensitive: uppercase sorts before lowercase", () => {
    expect(compareCodePoint("Zeta", "alpha")).toBe(-1);
    expect(compareCodePoint("alpha", "Zeta")).toBe(1);
  });

  it("returns 0 for equal strings and orders prefixes first", () => {
    expect(compareCodePoint("abc", "abc")).toBe(0);
    expect(compareCodePoint("ab", "abc")).toBe(-1);
  });

  it("orders astral characters after BMP characters above the surrogate range", () => {
    // U+1F600 (astral) vs U+FF5E (BMP): UTF-16 unit order would put the astral one first.
    expect(compareCodePoint("\u{1F600}", "\uFF5E")).toBe(1);
    expect(compareCodePoint("\uFF5E", "\u{1F600}")).toBe(-1);
  });
});

describe("sortByName", () => {
  it("sorts by code point and returns a new array without mutating", () => {
    const input = [{ name: "\u{1F600}" }, { name: "\uFF5E" }, { name: "b" }, { name: "B" }];
    const snapshot = [...input];
    const out = sortByName(input);
    expect(out.map((x) => x.name)).toEqual(["B", "b", "\uFF5E", "\u{1F600}"]);
    expect(out).not.toBe(input);
    expect(input).toEqual(snapshot);
  });

  it("is idempotent and order-independent (property)", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ unit: "binary" }), { maxLength: 20 }), (names) => {
        const items = names.map((name) => ({ name }));
        const once = sortByName(items).map((x) => x.name);
        const reversed = sortByName([...items].reverse()).map((x) => x.name);
        return JSON.stringify(once) === JSON.stringify(reversed) &&
          JSON.stringify(sortByName(sortByName(items)).map((x) => x.name)) === JSON.stringify(once);
      }),
    );
  });
});
