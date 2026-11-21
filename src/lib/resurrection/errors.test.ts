import { describe, expect, it } from "vitest";
import { ERROR_TABLE } from "@/lib/scan/response";
import {
  ISSUE_CREATE_UNAVAILABLE_MESSAGE,
  RESURRECTION_ERROR_TABLE,
  ResurrectionErrorSchema,
  mapGitHubFailure,
  toSafeError,
} from "./errors";

const now = new Date("2024-01-01T00:00:00Z");
const read = { now, mode: "user", phase: "read" } as const;

describe("RESURRECTION_ERROR_TABLE", () => {
  it("keeps every message within 140 characters", () => {
    for (const entry of Object.values(RESURRECTION_ERROR_TABLE)) {
      expect(entry.message.length).toBeLessThanOrEqual(140);
    }
  });

  it("reuses auth-ingestion messages", () => {
    expect(RESURRECTION_ERROR_TABLE.token_revoked.message).toBe(ERROR_TABLE.token_revoked.message);
    expect(RESURRECTION_ERROR_TABLE.rate_limited.message).toBe(ERROR_TABLE.rate_limited.message);
    expect(RESURRECTION_ERROR_TABLE.internal_error.message).toBe(ERROR_TABLE.internal_error.message);
  });
});

describe("toSafeError", () => {
  it("builds every table row with its status and a valid body", async () => {
    for (const [code, entry] of Object.entries(RESURRECTION_ERROR_TABLE)) {
      const parsedCode = ResurrectionErrorSchema.shape.error.shape.code.parse(code);
      const res = toSafeError(parsedCode);
      expect(res.status).toBe(entry.status);
      const body = ResurrectionErrorSchema.parse(await res.json());
      expect(body.error.message).toBe(entry.message);
    }
  });

  it("sets Retry-After for rate-limit codes only", async () => {
    const res = toSafeError("resurrect_rate_limited", { retryAfterSeconds: 7 });
    expect(res.headers.get("Retry-After")).toBe("7");
    expect(toSafeError("rate_limited", { retryAfterSeconds: 7 }).headers.get("Retry-After")).toBeNull();
  });

  it("accepts a custom message only from the constant", async () => {
    const ok = await toSafeError("github_unavailable", { message: ISSUE_CREATE_UNAVAILABLE_MESSAGE }).json();
    expect(ok.error.message).toBe(ISSUE_CREATE_UNAVAILABLE_MESSAGE);
    const bad = await toSafeError("github_unavailable", { message: "leak" }).json();
    expect(bad.error.message).toBe(RESURRECTION_ERROR_TABLE.github_unavailable.message);
  });
});

describe("mapGitHubFailure", () => {
  it("maps token_revoked per mode and phase", () => {
    expect(mapGitHubFailure({ status: 401 }, read)).toEqual({ code: "token_revoked", clearSession: true });
    expect(mapGitHubFailure({ status: 401 }, { ...read, mode: "demo" })).toEqual({
      code: "demo_unavailable",
    });
    expect(mapGitHubFailure({ status: 401 }, { ...read, phase: "issue-create" })).toEqual({
      code: "token_revoked",
      clearSession: true,
    });
  });

  it("maps the other kinds", () => {
    expect(mapGitHubFailure({ status: 429 }, read)).toEqual({ code: "rate_limited" });
    expect(mapGitHubFailure({ status: 403 }, read)).toEqual({ code: "forbidden" });
    expect(mapGitHubFailure({ status: 404 }, read)).toEqual({ code: "repo_not_found" });
    expect(mapGitHubFailure({ status: 500 }, read)).toEqual({ code: "github_unavailable" });
    expect(mapGitHubFailure({ status: 500 }, { ...read, phase: "issue-create" })).toEqual({
      code: "github_unavailable",
      message: ISSUE_CREATE_UNAVAILABLE_MESSAGE,
    });
  });

  it("includes a resetAt for rate limits with a reset header", () => {
    const failure = mapGitHubFailure(
      { status: 429, response: { headers: { "retry-after": "60" } } },
      read,
    );
    expect(failure).toEqual({ code: "rate_limited", resetAt: "2024-01-01T00:01:00.000Z" });
  });
});
