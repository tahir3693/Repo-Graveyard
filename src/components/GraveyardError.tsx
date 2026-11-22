import type { Ref } from "react";
import { graveyardErrorCopy } from "@/lib/graveyard/error-copy";
import { SignInButton } from "@/components/SignInButton";

export interface GraveyardErrorProps {
  /** Typed error code from the API, or null when unknown. */
  code: string | null;
  /** In demo mode the demo link is pointless, so it is hidden. */
  demo: boolean;
  onRetry: () => void;
  titleRef?: Ref<HTMLHeadingElement>;
}

/** Friendly failure panel: specific text per error code, Try again, and a demo link. */
export function GraveyardError({ code, demo, onRetry, titleRef }: GraveyardErrorProps) {
  const copy = graveyardErrorCopy(code);
  return (
    <div className="graveyard-error" role="alert" data-error-kind={copy.kind}>
      <h2 className="graveyard-error-title" tabIndex={-1} ref={titleRef}>
        {copy.title}
      </h2>
      <p className="graveyard-error-text">{copy.text}</p>
      {copy.kind === "not_signed_in" ? <SignInButton className="graveyard-button" /> : null}
      <button type="button" className="graveyard-button" onClick={onRetry}>
        Try again
      </button>
      {demo ? null : (
        <a href="/graveyard?demo=1" className="graveyard-button">
          Try the demo graveyard
        </a>
      )}
    </div>
  );
}
