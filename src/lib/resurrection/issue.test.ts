import { describe, expect, it, vi } from "vitest";
import type { IssueWriter } from "@/lib/github/issue-writer";
import {
  createIssue,
  isExpectedIssueUrl,
  ISSUE_FOOTER,
  prepareIssue,
} from "./issue";

const NOW = new Date("2025-01-01T00:00:00Z");
const ARGS = { login: "Octo", repo: "Thing", title: "T", body: "B", now: NOW };
const OK_URL = "https://github.com/octo/thing/issues/7";

function okWriter(): IssueWriter {
  return vi.fn(async () => ({
    status: 201,
    headers: {},
    data: { number: 7, html_url: OK_URL },
  }));
}

function failingWriter(error: unknown): IssueWriter {
  return vi.fn(async () => {
    throw error;
  });
}

describe("ISSUE_FOOTER", () => {
  it("is one line under 120 characters", () => {
    expect(ISSUE_FOOTER.length).toBeLessThan(120);
    expect(ISSUE_FOOTER).not.toMatch(/\n/);
  });
});

describe("prepareIssue", () => {
  it("sanitizes and appends the footer after the length check", () => {
    const result = prepareIssue("Hello <b>x</b>", "Ping @bob");
    expect(result).toEqual({
      ok: true,
      title: "Hello x",
      body: `Ping \`@bob\`\n\n${ISSUE_FOOTER}`,
    });
  });

  it("accepts a body at the limit even though the footer pushes it over", () => {
    expect(prepareIssue("t", "a".repeat(4000)).ok).toBe(true);
    expect(prepareIssue("t", "a".repeat(4001)).ok).toBe(false);
  });

  it("rejects empty, whitespace, line-break and over-long titles", () => {
    expect(prepareIssue("", "b").ok).toBe(false);
    expect(prepareIssue("   ", "b").ok).toBe(false);
    expect(prepareIssue("a\nb", "b").ok).toBe(false);
    expect(prepareIssue("a".repeat(100), "b").ok).toBe(true);
    expect(prepareIssue("a".repeat(101), "b").ok).toBe(false);
    expect(prepareIssue("t", "  ").ok).toBe(false);
  });
});

describe("isExpectedIssueUrl", () => {
  it("accepts the exact URL, case-insensitively", () => {
    expect(isExpectedIssueUrl(OK_URL, "Octo", "Thing", 7)).toBe(true);
  });

  it("rejects query, fragment, port and other hosts", () => {
    expect(isExpectedIssueUrl(`${OK_URL}?x=1`, "octo", "thing", 7)).toBe(false);
    expect(isExpectedIssueUrl(`${OK_URL}#a`, "octo", "thing", 7)).toBe(false);
    expect(isExpectedIssueUrl("https://github.com:444/octo/thing/issues/7", "octo", "thing", 7)).toBe(false);
    expect(isExpectedIssueUrl("https://evil.com/octo/thing/issues/7", "octo", "thing", 7)).toBe(false);
    expect(isExpectedIssueUrl(OK_URL, "octo", "thing", 8)).toBe(false);
  });
});

describe("createIssue", () => {
  it("sends exactly one POST with exactly four params and returns the URL", async () => {
    const writer = okWriter();
    const result = await createIssue(writer, ARGS);
    expect(result).toEqual({ ok: true, issueUrl: OK_URL, number: 7 });
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith("POST /repos/{owner}/{repo}/issues", {
      owner: "Octo",
      repo: "Thing",
      title: "T",
      body: "B",
    });
  });

  it("maps 410, 422 and 404 to route-specific codes with one call each", async () => {
    for (const [status, code] of [
      [410, "issues_disabled"],
      [422, "issue_rejected"],
      [404, "repo_not_found"],
    ] as const) {
      const writer = failingWriter(Object.assign(new Error("x"), { status }));
      const result = await createIssue(writer, ARGS);
      expect(result).toEqual({ ok: false, failure: { code } });
      expect(writer).toHaveBeenCalledTimes(1);
    }
  });

  it("maps a timeout to github_unavailable with the fixed message", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    const result = await createIssue(failingWriter(timeout), ARGS);
    expect(result).toMatchObject({
      ok: false,
      failure: { code: "github_unavailable", message: expect.stringContaining("may not have been created") },
    });
  });

  it("maps 401 to token_revoked with session clearing", async () => {
    const result = await createIssue(failingWriter({ status: 401 }), ARGS);
    expect(result).toEqual({ ok: false, failure: { code: "token_revoked", clearSession: true } });
  });

  it("maps a bad response or a bad URL to issue_result_unknown", async () => {
    for (const data of [
      null,
      { number: "7", html_url: OK_URL },
      { number: 7, html_url: `${OK_URL}?q=1` },
      { number: 7, html_url: "https://github.com:8443/octo/thing/issues/7" },
    ]) {
      const writer: IssueWriter = async () => ({ status: 201, headers: {}, data });
      expect(await createIssue(writer, ARGS)).toEqual({
        ok: false,
        failure: { code: "issue_result_unknown" },
      });
    }
  });

  it("never exposes the token or upstream text in a failure", async () => {
    const secret = "ghu_FAKE_SECRET_TOKEN";
    const long = "UPSTREAM".repeat(500);
    const error = Object.assign(new Error(`${secret} ${long}`), {
      status: 500,
      response: { data: { message: `${secret} ${long}` }, headers: {} },
    });
    const result = await createIssue(failingWriter(error), ARGS);
    const text = JSON.stringify(result);
    expect(text).not.toContain(secret);
    expect(text).not.toContain("UPSTREAM");
    expect(result.ok).toBe(false);
  });
});
