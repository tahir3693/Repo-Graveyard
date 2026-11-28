import type { Ref } from "react";
import { graveyardErrorCopy } from "@/lib/graveyard/error-copy";
import { SignInButton } from "@/components/SignInButton";

export interface GraveyardErrorProps {
  /** Typed error code from the API, or null when unknown. */
  code: string | null;
  onRetry: () => void;
  titleRef?: Ref<HTMLHeadingElement>;
}

/** Friendly failure panel: specific text per error code, Try again, and a demo link. */
export function GraveyardError({ code, onRetry, titleRef }: GraveyardErrorProps) {
  const copy = graveyardErrorCopy(code);
  return (
    <div className="graveyard-error" role="alert" data-error-kind={copy.kind}>
      <h2 className="graveyard-error-title" tabIndex={-1} ref={titleRef}>
        {copy.title}
      </h2>
      <p className="graveyard-error-text">{copy.text}</p>
      {copy.kind === "not_signed_in" ? <SignInButton className="btn btn-primary" /> : null}
      {/* One primary action per panel: sign in when that is the problem, otherwise retry. */}
      <button
        type="button"
        className={`btn ${copy.kind === "not_signed_in" ? "btn-secondary" : "btn-primary"}`}
        onClick={onRetry}
      >
        Try again
      </button>
      <a href="/graveyard?demo=1" className="btn btn-secondary">
        Try the demo graveyard
      </a>
    </div>
  );
}
