"use client";

import { startSignOut } from "@/lib/auth/client-actions";

export interface SignOutButtonProps {
  className?: string;
}

export function SignOutButton({ className = "landing-signout" }: SignOutButtonProps) {
  return (
    <button type="button" className={className} onClick={() => startSignOut()}>
      Sign out
    </button>
  );
}
