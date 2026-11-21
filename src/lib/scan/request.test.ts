import { describe, expect, it } from "vitest";
import { parseScanRequest } from "./request";

describe("parseScanRequest", () => {
  it("accepts an empty object with false defaults", () => {
    expect(parseScanRequest({})).toEqual({ demo: false, includeForks: false });
  });

  it("accepts boolean fields", () => {
    expect(parseScanRequest({ demo: true, includeForks: true })).toEqual({
      demo: true,
      includeForks: true,
    });
  });

  it("strips unknown keys such as username", () => {
    expect(parseScanRequest({ demo: true, username: "octocat" })).toEqual({
      demo: true,
      includeForks: false,
    });
  });

  it("rejects non-boolean fields", () => {
    expect(parseScanRequest({ demo: "true" })).toBeNull();
    expect(parseScanRequest({ includeForks: 1 })).toBeNull();
  });

  it("rejects non-objects", () => {
    expect(parseScanRequest(null)).toBeNull();
    expect(parseScanRequest("x")).toBeNull();
    expect(parseScanRequest([])).toBeNull();
  });
});
