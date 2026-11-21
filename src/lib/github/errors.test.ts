import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { classifyGitHubFailure, ScanFailureError } from "./errors";

const now = new Date("2025-01-01T00:00:00.000Z");

function failure(status: number, headers: Record<string, string> = {}, message = "x") {
  return { status, message, response: { headers } };
}

describe("classifyGitHubFailure", () => {
  it("classifies 429 as rate limited", () => {
    expect(classifyGitHubFailure(failure(429), now)).toEqual({ kind: "rate_limited" });
  });

  it("classifies 403 with remaining 0 and reset as rate limited with resetAt", () => {
    const result = classifyGitHubFailure(
      failure(403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1735689600" }),
      now,
    );
    expect(result).toEqual({ kind: "rate_limited", resetAt: "2025-01-01T00:00:00.000Z" });
  });

  it("classifies 403 with retry-after as rate limited and adds it to now", () => {
    const result = classifyGitHubFailure(failure(403, { "retry-after": "60" }), now);
    expect(result).toEqual({ kind: "rate_limited", resetAt: "2025-01-01T00:01:00.000Z" });
  });

  it("classifies 403 with a rate limit message as rate limited", () => {
    const result = classifyGitHubFailure(failure(403, {}, "API Rate Limit exceeded"), now);
    expect(result).toEqual({ kind: "rate_limited" });
  });

  it("classifies 403 without rate-limit signals as forbidden", () => {
    const result = classifyGitHubFailure(
      failure(403, { "x-ratelimit-remaining": "42" }, "Resource not accessible"),
      now,
    );
    expect(result).toEqual({ kind: "forbidden" });
  });

  it("matches header names case-insensitively", () => {
    const result = classifyGitHubFailure(failure(403, { "X-RateLimit-Remaining": "0" }), now);
    expect(result.kind).toBe("rate_limited");
  });

  it("prefers x-ratelimit-reset over retry-after", () => {
    const result = classifyGitHubFailure(
      failure(429, { "x-ratelimit-reset": "1735689600", "retry-after": "5" }),
      now,
    );
    expect(result).toEqual({ kind: "rate_limited", resetAt: "2025-01-01T00:00:00.000Z" });
  });

  it("classifies 401 as token revoked", () => {
    expect(classifyGitHubFailure(failure(401), now)).toEqual({ kind: "token_revoked" });
  });

  it("classifies 404 as not found", () => {
    expect(classifyGitHubFailure(failure(404), now)).toEqual({ kind: "not_found" });
  });

  it("classifies 5xx, aborts and status-less errors as unavailable", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(classifyGitHubFailure(failure(500), now)).toEqual({ kind: "unavailable" });
    expect(classifyGitHubFailure(failure(503), now)).toEqual({ kind: "unavailable" });
    expect(classifyGitHubFailure(abort, now)).toEqual({ kind: "unavailable" });
    expect(classifyGitHubFailure(new Error("boom"), now)).toEqual({ kind: "unavailable" });
    expect(classifyGitHubFailure(null, now)).toEqual({ kind: "unavailable" });
    expect(classifyGitHubFailure("text", now)).toEqual({ kind: "unavailable" });
  });

  it("omits resetAt for malformed header values", () => {
    for (const bad of ["abc", "", "-5", "NaN", "Infinity", "1e999"]) {
      expect(
        classifyGitHubFailure(failure(429, { "x-ratelimit-reset": bad, "retry-after": bad }), now),
      ).toEqual({ kind: "rate_limited" });
    }
  });

  it("falls back to retry-after when x-ratelimit-reset is malformed", () => {
    const result = classifyGitHubFailure(
      failure(429, { "x-ratelimit-reset": "soon", "retry-after": "10" }),
      now,
    );
    expect(result).toEqual({ kind: "rate_limited", resetAt: "2025-01-01T00:00:10.000Z" });
  });

  it("omits resetAt when the epoch is out of the Date range", () => {
    expect(classifyGitHubFailure(failure(429, { "x-ratelimit-reset": "9e15" }), now)).toEqual({
      kind: "rate_limited",
    });
  });

  it("tolerates malformed error shapes", () => {
    expect(classifyGitHubFailure({ status: "429", response: { headers: 5 } }, now)).toEqual({
      kind: "unavailable",
    });
    expect(classifyGitHubFailure({ status: 429, response: "nope" }, now)).toEqual({
      kind: "rate_limited",
    });
  });

  it("never throws for arbitrary input", () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        expect(() => classifyGitHubFailure(value, now)).not.toThrow();
      }),
    );
  });
});

describe("ScanFailureError", () => {
  it("exposes only the classified failure and a fixed message", () => {
    const err = new ScanFailureError({ kind: "rate_limited", resetAt: "2025-01-01T00:00:00.000Z" });
    expect(err.failure).toEqual({ kind: "rate_limited", resetAt: "2025-01-01T00:00:00.000Z" });
    expect(err.message).toBe("Scan failed: rate_limited");
    expect(Object.keys(err).sort()).toEqual(["failure"]);
  });

  it("carries no upstream text from the classified error", () => {
    const upstream = failure(401, { authorization: "token ghp_secret" }, "Bad credentials ghp_secret");
    const err = new ScanFailureError(classifyGitHubFailure(upstream, now));
    expect(JSON.stringify(err)).not.toContain("ghp_secret");
    expect(err.message).not.toContain("ghp_secret");
    expect(String(err.stack)).not.toContain("ghp_secret");
  });
});
