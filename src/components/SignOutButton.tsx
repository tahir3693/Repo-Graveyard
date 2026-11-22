"use client";

import { startSignOut } from "@/lib/auth/client-actions";

export function SignOutButton() {
  return (
    <button type="button" className="landing-signout" onClick={() => startSignOut()}>
      Sign out
    </button>
  );
}
