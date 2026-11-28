import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";
import { SIGN_IN_NOT_SET_UP_MESSAGE } from "@/lib/auth/error-messages";

const NOT_SET_UP_ID = "signin-not-set-up";

export interface LandingActionsProps {
  /** Only the login is needed. The access token is never passed to this component. */
  login: string | null;
  /** False when the server has no GitHub OAuth settings. Defaults to true. */
  signInConfigured?: boolean;
  /** Friendly text for a failed sign-in, or null. */
  errorMessage: string | null;
}

function DemoForm() {
  // A GET form submits to /graveyard?demo=1 with no client JavaScript.
  return (
    <form action="/graveyard" method="get" className="landing-demo-form">
      <input type="hidden" name="demo" value="1" />
      <button type="submit" className="btn btn-secondary btn-lg">
        Try demo graveyard
      </button>
    </form>
  );
}

/** Landing page buttons for the signed-in and signed-out states. */
export function LandingActions({
  login,
  errorMessage,
  signInConfigured = true,
}: LandingActionsProps) {
  return (
    <>
      {errorMessage !== null && (
        <p className="landing-error" role="alert">
          {errorMessage}
        </p>
      )}
      <div className="landing-actions">
        {login === null ? (
          <>
            <SignInButton configured={signInConfigured} describedBy={NOT_SET_UP_ID} />
            <DemoForm />
          </>
        ) : (
          <>
            <a href="/graveyard" className="btn btn-primary btn-lg">
              Open my graveyard
            </a>
            <DemoForm />
          </>
        )}
      </div>
      {login === null && !signInConfigured && (
        <p id={NOT_SET_UP_ID} className="landing-error" role="status">
          {SIGN_IN_NOT_SET_UP_MESSAGE}
        </p>
      )}
      {login !== null && (
        <p className="landing-signed-in">
          Signed in as <strong>{login}</strong> <SignOutButton />
        </p>
      )}
    </>
  );
}
