import { describe, expect, it } from "vitest";
import { NO_FILTERS } from "./types";

describe("NO_FILTERS", () => {
  it("selects every status and every language", () => {
    expect(NO_FILTERS.statuses).toEqual([]);
    expect(NO_FILTERS.language).toEqual({ kind: "all" });
  });
});
