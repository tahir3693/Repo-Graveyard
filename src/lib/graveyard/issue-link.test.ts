import { describe, expect, it } from "vitest";
import { safeIssueLink } from "./issue-link";

describe("safeIssueLink", () => {
  it.each([
    "https://github.com/octo/repo/issues/12",
    "https://github.com/octo/repo/issues/12#issuecomment-1",
    "https://github.com:443/octo/repo/issues/12",
  ])("accepts %s", (url) => {
    expect(safeIssueLink(url)).toBe(url);
  });

  it.each([
    "http://github.com/octo/repo/issues/12",
    "https://github.com.evil.com/octo/repo/issues/12",
    "https://evil.com/github.com",
    "https://user:pw@github.com/octo/repo/issues/12",
    "https://user@github.com/octo/repo/issues/12",
    "https://github.com:8443/octo/repo/issues/12",
    "https://www.github.com/octo/repo/issues/12",
    "javascript:alert(1)",
    "not a url",
    "",
  ])("rejects %s", (url) => {
    expect(safeIssueLink(url)).toBeNull();
  });

  it.each([42, null, undefined, {}, ["https://github.com/a"]])(
    "rejects non-string %p",
    (value) => {
      expect(safeIssueLink(value)).toBeNull();
    },
  );
});
