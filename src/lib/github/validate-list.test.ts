import { describe, expect, it } from "vitest";
import { splitValidEntries } from "./validate-list";

const valid = {
  name: "crypt",
  html_url: "https://github.com/octocat/crypt",
  description: null,
  fork: false,
  archived: false,
  stargazers_count: 1,
  open_issues_count: 0,
  language: null,
  pushed_at: null,
  default_branch: "main",
  owner: { login: "octocat" },
};

describe("splitValidEntries", () => {
  it("counts one invalid entry as skipped", () => {
    const result = splitValidEntries([valid, { name: 5 }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.repos).toHaveLength(1);
      expect(result.skippedInvalid).toBe(1);
    }
  });

  it("fails when every entry is invalid", () => {
    expect(splitValidEntries([{}, null, "x"])).toEqual({ ok: false });
  });

  it("accepts an empty array", () => {
    expect(splitValidEntries([])).toEqual({ ok: true, repos: [], skippedInvalid: 0 });
  });

  it.each([null, undefined, {}, "x", 5])("fails for non-array %j", (input) => {
    expect(splitValidEntries(input)).toEqual({ ok: false });
  });
});
