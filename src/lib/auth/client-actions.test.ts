import { describe, expect, it, vi } from "vitest";
import {
  SIGN_IN_CALLBACK_URL,
  SIGN_OUT_CALLBACK_URL,
  startGitHubSignIn,
  startSignOut,
} from "./client-actions";

describe("startGitHubSignIn", () => {
  it("signs in with github and returns to /graveyard", () => {
    const signInImpl = vi.fn();
    startGitHubSignIn(signInImpl);
    expect(SIGN_IN_CALLBACK_URL).toBe("/graveyard");
    expect(signInImpl).toHaveBeenCalledExactlyOnceWith("github", { callbackUrl: "/graveyard" });
  });
});

describe("startSignOut", () => {
  it("signs out and returns to the landing page", () => {
    const signOutImpl = vi.fn();
    startSignOut(signOutImpl);
    expect(SIGN_OUT_CALLBACK_URL).toBe("/");
    expect(signOutImpl).toHaveBeenCalledExactlyOnceWith({ callbackUrl: "/" });
  });
});
