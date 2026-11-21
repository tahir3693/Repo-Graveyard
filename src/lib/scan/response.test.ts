import { describe, expect, it } from "vitest";
import {
  ERROR_CODES,
  ERROR_TABLE,
  SafeErrorSchema,
  ScanSuccessSchema,
  buildSafeError,
  safeErrorResponse,
} from "./response";

const EXPECTED: Record<string, [number, string]> = {
  validation_error: [400, "The request was not valid."],
  unauthorized: [401, "Sign in to scan your repositories."],
  token_revoked: [401, "Your GitHub session expired. Sign in again."],
  forbidden: [403, "GitHub refused this request."],
  account_not_found: [404, "That GitHub account was not found."],
  rate_limited: [429, "GitHub request limits were reached. Try again later."],
  invalid_github_response: [502, "The scan could not be completed."],
  github_unavailable: [502, "GitHub could not be reached. Try again later."],
  auth_not_configured: [503, "Sign-in is not available right now."],
  demo_unavailable: [503, "Demo mode is not available right now."],
  internal_error: [500, "Something went wrong. Try again."],
};

describe("error table", () => {
  it("covers exactly the expected codes", () => {
    expect([...ERROR_CODES].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(ERROR_CODES)("%s has its fixed status and message", async (code) => {
    const [status, message] = EXPECTED[code];
    expect(ERROR_TABLE[code]).toEqual({ status, message });
    const res = safeErrorResponse(code);
    expect(res.status).toBe(status);
    const body = SafeErrorSchema.parse(await res.json());
    expect(body).toEqual({ error: { code, message } });
  });
});

describe("safeErrorResponse", () => {
  it("maps auth_not_configured to 503", () => {
    expect(safeErrorResponse("auth_not_configured").status).toBe(503);
  });

  it("includes a valid resetAt only for rate_limited", async () => {
    const resetAt = "2026-01-01T00:00:00.000Z";
    const limited = buildSafeError("rate_limited", { resetAt });
    expect(limited.error.resetAt).toBe(resetAt);
    expect(buildSafeError("forbidden", { resetAt }).error).not.toHaveProperty(
      "resetAt",
    );
    const res = safeErrorResponse("rate_limited", { resetAt });
    expect(SafeErrorSchema.parse(await res.json()).error.resetAt).toBe(resetAt);
  });

  it("drops an invalid resetAt", () => {
    expect(
      buildSafeError("rate_limited", { resetAt: "soon" }).error,
    ).not.toHaveProperty("resetAt");
  });
});

describe("ScanSuccessSchema", () => {
  it("accepts a minimal empty-account result", () => {
    const parsed = ScanSuccessSchema.safeParse({
      mode: "user",
      repos: [],
      skippedForks: 0,
      skippedInvalid: 0,
      truncated: false,
      code: "empty_account",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown mode", () => {
    const parsed = ScanSuccessSchema.safeParse({
      mode: "other",
      repos: [],
      skippedForks: 0,
      skippedInvalid: 0,
      truncated: false,
    });
    expect(parsed.success).toBe(false);
  });
});
