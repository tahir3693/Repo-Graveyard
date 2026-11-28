"use client";

import { startGitHubSignIn } from "@/lib/auth/client-actions";

export interface SignInButtonProps {
  className?: string;
  /**
   * False when the server has no GitHub OAuth settings. The button stays visible, does
   * nothing, and the parent shows the explanation (id passed as `describedBy`).
   */
  configured?: boolean;
  describedBy?: string;
}

export function SignInButton({
  className = "btn btn-primary btn-lg",
  configured = true,
  describedBy,
}: SignInButtonProps) {
  return (
    <button
      type="button"
      className={className}
      aria-disabled={configured ? undefined : true}
      aria-describedby={configured ? undefined : describedBy}
      onClick={configured ? () => startGitHubSignIn() : undefined}
    >
      Sign in with GitHub
    </button>
  );
}
