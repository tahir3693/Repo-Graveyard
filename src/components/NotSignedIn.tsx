import { SignInButton } from "@/components/SignInButton";

/** Shown on /graveyard when there is no session and demo mode was not requested. */
export function NotSignedIn() {
  return (
    <div className="graveyard-error" role="status">
      <h2 className="graveyard-error-title">You are not signed in</h2>
      <p className="graveyard-error-text">
        Sign in with GitHub to visit your own graveyard, or wander through the demo first.
      </p>
      <SignInButton className="graveyard-button" />
      <a href="/graveyard?demo=1" className="graveyard-button">
        Try the demo
      </a>
    </div>
  );
}
