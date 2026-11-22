import { describe, expect, it } from "vitest";
import { graveyardErrorCopy } from "./error-copy";

describe("graveyardErrorCopy", () => {
  it.each([
    ["rate_limited", "rate_limited"],
    ["github_unavailable", "github_unavailable"],
    ["invalid_github_response", "github_unavailable"],
    ["unauthorized", "not_signed_in"],
    ["token_revoked", "not_signed_in"],
    ["auth_not_configured", "sign_in_unavailable"],
    ["demo_unavailable", "demo_unavailable"],
    ["internal_error", "unknown"],
    ["something_new", "unknown"],
    [null, "unknown"],
  ])("maps %s to %s", (code, kind) => {
    expect(graveyardErrorCopy(code).kind).toBe(kind);
  });

  it("gives each kind its own non-empty title and text", () => {
    const codes = ["rate_limited", "github_unavailable", "unauthorized", "auth_not_configured", "demo_unavailable", null];
    const titles = new Set(codes.map((c) => graveyardErrorCopy(c).title));
    expect(titles.size).toBe(codes.length);
    for (const c of codes) expect(graveyardErrorCopy(c).text.length).toBeGreaterThan(10);
  });
});
