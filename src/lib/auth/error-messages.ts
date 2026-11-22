export const SIGN_IN_CANCELLED_MESSAGE =
  "The gate stayed shut. GitHub did not let us in, so no repos were read. You can try again.";
export const SIGN_IN_CONFIG_MESSAGE =
  "The gate is not set up yet, so sign-in is resting for now. The demo graveyard still works.";
export const SIGN_IN_CALLBACK_MESSAGE =
  "The spirits lost the way back from GitHub. Nothing was saved. Try signing in again.";
export const SIGN_IN_FAILED_MESSAGE = "Sign-in failed. You can try again.";

/**
 * Maps the `?error=` code Auth.js adds to the landing page URL to a short message.
 * Never echoes the input, so a crafted URL cannot inject text.
 */
export function authErrorMessage(error: unknown): string {
  switch (error) {
    case "AccessDenied":
      return SIGN_IN_CANCELLED_MESSAGE;
    case "Configuration":
      return SIGN_IN_CONFIG_MESSAGE;
    case "Callback":
    case "OAuthCallback":
      return SIGN_IN_CALLBACK_MESSAGE;
    default:
      return SIGN_IN_FAILED_MESSAGE;
  }
}

/** Returns a message only when the URL actually carries an error value. */
export function readAuthErrorMessage(error: unknown): string | null {
  if (error === undefined || error === null || error === "") return null;
  return authErrorMessage(error);
}
