import { SignInButton } from "@/components/SignInButton";
import { SIGN_IN_NOT_SET_UP_MESSAGE } from "@/lib/auth/error-messages";

const NOT_SET_UP_ID = "graveyard-signin-not-set-up";

export interface NotSignedInProps {
  /** False when the server has no GitHub OAuth settings. Defaults to true. */
  signInConfigured?: boolean;
}

/** Shown on /graveyard when there is no session and demo mode was not requested. */
export function NotSignedIn({ signInConfigured = true }: NotSignedInProps) {
  return (
    <div className="graveyard-error graveyard-notice" role="status">
      <h2 className="graveyard-error-title">You are not signed in</h2>
      <p className="graveyard-error-text">
        Sign in with GitHub to visit your own graveyard, or wander through the demo first.
      </p>
      <SignInButton
        className="btn btn-primary"
        configured={signInConfigured}
        describedBy={NOT_SET_UP_ID}
      />
      {signInConfigured ? null : (
        <p id={NOT_SET_UP_ID} className="graveyard-error-text">
          {SIGN_IN_NOT_SET_UP_MESSAGE}
        </p>
      )}
      <a href="/graveyard?demo=1" className="btn btn-secondary">
        Try the demo graveyard
      </a>
    </div>
  );
}
