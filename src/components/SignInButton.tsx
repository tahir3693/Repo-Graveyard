"use client";

import { startGitHubSignIn } from "@/lib/auth/client-actions";

export interface SignInButtonProps {
  className?: string;
}

export function SignInButton({
  className = "landing-action landing-action-primary",
}: SignInButtonProps) {
  return (
    <button type="button" className={className} onClick={() => startGitHubSignIn()}>
      Sign in with GitHub
    </button>
  );
}
