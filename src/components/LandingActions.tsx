import { SignInButton } from "@/components/SignInButton";
import { SignOutButton } from "@/components/SignOutButton";

export interface LandingActionsProps {
  /** Only the login is needed. The access token is never passed to this component. */
  login: string | null;
  /** Friendly text for a failed sign-in, or null. */
  errorMessage: string | null;
}

function DemoForm() {
  // A GET form submits to /graveyard?demo=1 with no client JavaScript.
  return (
    <form action="/graveyard" method="get" className="landing-demo-form">
      <input type="hidden" name="demo" value="1" />
      <button type="submit" className="landing-action landing-action-secondary">
        Try demo graveyard
      </button>
    </form>
  );
}

/** Landing page buttons for the signed-in and signed-out states. */
export function LandingActions({ login, errorMessage }: LandingActionsProps) {
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
            <SignInButton />
            <DemoForm />
          </>
        ) : (
          <>
            <a href="/graveyard" className="landing-action landing-action-primary">
              Open my graveyard
            </a>
            <DemoForm />
          </>
        )}
      </div>
      {login !== null && (
        <p className="landing-signed-in">
          Signed in as <strong>{login}</strong> <SignOutButton />
        </p>
      )}
    </>
  );
}
