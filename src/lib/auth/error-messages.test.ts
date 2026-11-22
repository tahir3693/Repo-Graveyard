import { describe, expect, it } from "vitest";
import {
  SIGN_IN_CALLBACK_MESSAGE,
  SIGN_IN_CANCELLED_MESSAGE,
  SIGN_IN_CONFIG_MESSAGE,
  SIGN_IN_FAILED_MESSAGE,
  authErrorMessage,
  readAuthErrorMessage,
} from "./error-messages";

describe("authErrorMessage", () => {
  it.each([
    ["AccessDenied", SIGN_IN_CANCELLED_MESSAGE],
    ["Configuration", SIGN_IN_CONFIG_MESSAGE],
    ["Callback", SIGN_IN_CALLBACK_MESSAGE],
    ["OAuthCallback", SIGN_IN_CALLBACK_MESSAGE],
  ])("maps %s to its own message", (code, expected) => {
    expect(authErrorMessage(code)).toBe(expected);
  });

  it("uses three distinct messages for the three mapped codes", () => {
    const messages = new Set([
      authErrorMessage("AccessDenied"),
      authErrorMessage("Configuration"),
      authErrorMessage("Callback"),
    ]);
    expect(messages.size).toBe(3);
  });

  it.each([
    undefined,
    null,
    "",
    "accessdenied",
    ["AccessDenied"],
    ["a", "b"],
    42,
    "<script>alert(1)</script>",
  ])("maps %j to the generic message without echoing it", (value) => {
    const message = authErrorMessage(value);
    expect(message).toBe(SIGN_IN_FAILED_MESSAGE);
    if (typeof value === "string" && value.length > 0) {
      expect(message).not.toContain(value);
    }
  });
});

describe("readAuthErrorMessage", () => {
  it.each([undefined, null, ""])("returns null for %j", (value) => {
    expect(readAuthErrorMessage(value)).toBeNull();
  });

  it("returns the mapped message when an error is present", () => {
    expect(readAuthErrorMessage("AccessDenied")).toBe(SIGN_IN_CANCELLED_MESSAGE);
    expect(readAuthErrorMessage("SomethingElse")).toBe(SIGN_IN_FAILED_MESSAGE);
  });
});
