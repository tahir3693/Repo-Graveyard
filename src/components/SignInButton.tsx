"use client";

import { signIn } from "next-auth/react";

export function SignInButton() {
  return (
    <button
      type="button"
      className="landing-action landing-action-primary"
      onClick={() => void signIn("github")}
    >
      Sign in with GitHub
    </button>
  );
}
