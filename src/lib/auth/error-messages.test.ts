import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./error-messages";

describe("authErrorMessage", () => {
  it("maps AccessDenied to the cancelled message", () => {
    expect(authErrorMessage("AccessDenied")).toBe("Sign-in was cancelled.");
  });

  it.each([
    undefined,
    null,
    "",
    "Configuration",
    "accessdenied",
    ["AccessDenied"],
    ["a", "b"],
    42,
    "<script>alert(1)</script>",
  ])("maps %j to the failed message without echoing it", (value) => {
    const message = authErrorMessage(value);
    expect(message).toBe("Sign-in failed. You can try again.");
    if (typeof value === "string" && value.length > 0) {
      expect(message).not.toContain(value);
    }
  });
});
