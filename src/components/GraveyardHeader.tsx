import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { skippedText } from "@/lib/graveyard/view";

export type GraveyardBadge = "Demo" | "Sample repos";

export interface GraveyardHeaderProps {
  /** One-line summary built from the real data, or null while loading or on error. */
  summary: string | null;
  /** Shown when demo mode or bundled sample data is in use. */
  badge: GraveyardBadge | null;
  /** How many repos the scan skipped because their data could not be read. Shown when above 0. */
  skippedCount?: number;
  /** The signed-in GitHub login, or null. Only a login is needed, never a token. */
  login: string | null;
}

/** The page header: back link, sign out, the one h1, the summary line and the badge. */
export function GraveyardHeader({ summary, badge, login, skippedCount = 0 }: GraveyardHeaderProps) {
  const skipped = skippedText(skippedCount);
  return (
    <header className="graveyard-header">
      <div className="graveyard-header-bar">
        <Link href="/" className="btn btn-quiet graveyard-back">
          <span aria-hidden="true">{"\u2190"} </span>Back to home
        </Link>
        {login === null ? null : (
          <div className="graveyard-session">
            <span className="graveyard-session-text">
              Signed in as <strong>{login}</strong>
            </span>
            <SignOutButton />
          </div>
        )}
      </div>
      <h1 className="graveyard-title">The Graveyard</h1>
      {summary === null ? null : <p className="graveyard-summary">{summary}</p>}
      {badge === null ? null : <p className="graveyard-badge">{badge}</p>}
      {skipped === null ? null : <p className="graveyard-skipped">{skipped}</p>}
    </header>
  );
}
