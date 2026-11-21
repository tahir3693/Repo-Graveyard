export const SIGN_IN_CANCELLED_MESSAGE = "Sign-in was cancelled.";
export const SIGN_IN_FAILED_MESSAGE = "Sign-in failed. You can try again.";

export function authErrorMessage(error: unknown): string {
  return error === "AccessDenied" ? SIGN_IN_CANCELLED_MESSAGE : SIGN_IN_FAILED_MESSAGE;
}
