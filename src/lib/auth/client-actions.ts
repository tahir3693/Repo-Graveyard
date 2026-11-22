import { signIn, signOut } from "next-auth/react";

/** Where Auth.js sends the user after a successful GitHub sign-in. */
export const SIGN_IN_CALLBACK_URL = "/graveyard";
/** Where Auth.js sends the user after sign-out. */
export const SIGN_OUT_CALLBACK_URL = "/";

type SignInFn = (provider: string, options: { callbackUrl: string }) => unknown;
type SignOutFn = (options: { callbackUrl: string }) => unknown;

/** Browser only. Starts the GitHub OAuth flow and returns to the graveyard. */
export function startGitHubSignIn(signInImpl: SignInFn = signIn): void {
  void signInImpl("github", { callbackUrl: SIGN_IN_CALLBACK_URL });
}

/** Browser only. Clears the session cookie and returns to the landing page. */
export function startSignOut(signOutImpl: SignOutFn = signOut): void {
  void signOutImpl({ callbackUrl: SIGN_OUT_CALLBACK_URL });
}
