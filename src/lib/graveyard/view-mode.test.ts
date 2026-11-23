import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseViewMode, VIEW_MODES, withViewMode } from "./view-mode";

describe("parseViewMode", () => {
  it("defaults to the graveyard", () => {
    for (const value of [undefined, null, "", "graveyard", "grid", "LIST", "list ", "1"]) {
      expect(parseViewMode(value)).toBe("graveyard");
    }
  });

  it("reads exactly list as the list, and the first value of a repeated parameter", () => {
    expect(parseViewMode("list")).toBe("list");
    expect(parseViewMode(["list", "graveyard"])).toBe("list");
    expect(parseViewMode(["graveyard", "list"])).toBe("graveyard");
    expect(parseViewMode([])).toBe("graveyard");
  });

  it("property: always returns one of the two modes", () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)), (value) => {
        expect(VIEW_MODES).toContain(parseViewMode(value));
      }),
    );
  });
});

describe("withViewMode", () => {
  it("adds view=list and keeps other parameters", () => {
    expect(withViewMode("", "list")).toBe("?view=list");
    expect(withViewMode("?demo=1", "list")).toBe("?demo=1&view=list");
  });

  it("removes the parameter for the default mode, leaving no empty query", () => {
    expect(withViewMode("?view=list", "graveyard")).toBe("");
    expect(withViewMode("?demo=1&view=list", "graveyard")).toBe("?demo=1");
  });

  it("replaces an existing value instead of repeating it", () => {
    expect(withViewMode("?view=list&view=list", "list")).toBe("?view=list");
  });

  it("property: the mode survives a round trip and other parameters are kept", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VIEW_MODES),
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 6 }).filter((k) => k !== "view"),
          fc.string({ maxLength: 8 }),
          { maxKeys: 4 },
        ),
        (mode, others) => {
          const base = new URLSearchParams(others).toString();
          const next = withViewMode(base === "" ? "" : `?${base}`, mode);
          const parsed = new URLSearchParams(next);
          expect(parseViewMode(parsed.get("view"))).toBe(mode);
          for (const [key, value] of Object.entries(others)) expect(parsed.get(key)).toBe(value);
        },
      ),
    );
  });
});
