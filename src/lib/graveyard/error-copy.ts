/**
 * Friendly, haunted copy for a failed graveyard scan. Takes the typed error code from the
 * API (or null) and returns fixed text. Never echoes server text.
 */
export type GraveyardErrorKind =
  | "rate_limited"
  | "github_unavailable"
  | "not_signed_in"
  | "sign_in_unavailable"
  | "demo_unavailable"
  | "unknown";

export type GraveyardErrorCopy = { kind: GraveyardErrorKind; title: string; text: string };

const COPY: Record<GraveyardErrorKind, Omit<GraveyardErrorCopy, "kind">> = {
  rate_limited: {
    title: "GitHub asked the spirits to wait",
    text: "GitHub is limiting requests for now. Your repos are only resting. Try again in a little while.",
  },
  github_unavailable: {
    title: "The graveyard cannot reach GitHub",
    text: "GitHub did not answer from beyond the fog. Your repos are safe. Try again in a moment.",
  },
  not_signed_in: {
    title: "The gates are locked until you sign in",
    text: "Sign in with GitHub to visit your own graveyard, or wander through the demo first.",
  },
  sign_in_unavailable: {
    title: "GitHub sign-in is not set up yet",
    text: "GitHub sign-in is not set up on this server yet. Try the demo graveyard.",
  },
  demo_unavailable: {
    title: "The demo graveyard is sleeping",
    text: "The demo could not be opened right now. It is only resting. Try again in a moment.",
  },
  unknown: {
    title: "The graveyard gates are stuck",
    text: "The repos could not be read this time. They are only resting. Try again in a moment.",
  },
};

function kindFromCode(code: string | null): GraveyardErrorKind {
  switch (code) {
    case "rate_limited":
      return "rate_limited";
    case "github_unavailable":
    case "invalid_github_response":
      return "github_unavailable";
    case "unauthorized":
    case "token_revoked":
      return "not_signed_in";
    case "auth_not_configured":
      return "sign_in_unavailable";
    case "demo_unavailable":
      return "demo_unavailable";
    default:
      return "unknown";
  }
}

export function graveyardErrorCopy(code: string | null): GraveyardErrorCopy {
  const kind = kindFromCode(code);
  return { kind, ...COPY[kind] };
}
