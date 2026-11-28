import { LanternArt } from "./StateArt";

const PLACEHOLDERS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Loading state: a lantern that breathes, then skeleton tombstones that pulse gently.
 * Both stand still under reduced motion.
 */
export function GraveyardSkeleton() {
  return (
    <div className="graveyard-skeleton-wrap">
      <LanternArt lit pulsing />
      <p className="graveyard-loading" role="status">
        Digging up the graveyard{"\u2026"}
      </p>
      <ul className="graveyard-stones" aria-hidden="true">
        {PLACEHOLDERS.map((n) => (
          <li key={n} className="graveyard-stone">
            <span className="graveyard-skeleton">
              <span className="graveyard-skeleton-bar graveyard-skeleton-bar-title" />
              <span className="graveyard-skeleton-bar graveyard-skeleton-bar-chip" />
              <span className="graveyard-skeleton-bar" />
              <span className="graveyard-skeleton-bar graveyard-skeleton-bar-short" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
