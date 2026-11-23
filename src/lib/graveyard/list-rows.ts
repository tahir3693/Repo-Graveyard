/**
 * Pure rows for the list view. Every cell is plain text from the same scored data and the same
 * wording as the drawer, so the list and the scene never disagree.
 */
import { CI_TEXT, formatLastCommit } from "@/lib/graveyard/drawer-facts";
import type { GraveEntry } from "@/lib/graveyard/tombstones";
import { FILTER_LABEL } from "@/lib/graveyard/view";
import type { Status } from "@/lib/scoring";

export type ListRow = {
  name: string;
  status: Status;
  statusLabel: string;
  cause: string;
  lastCommit: string;
  stars: string;
  ci: string;
};

/** Column order of the table: repo, status, cause, last commit, stars, CI. */
export const LIST_COLUMNS = ["Repo", "Status", "Cause", "Last commit", "Stars", "CI"] as const;

export function buildListRows(entries: readonly GraveEntry[]): ListRow[] {
  return entries.map(({ repo, tombstone }) => ({
    name: repo.name,
    status: tombstone.status,
    statusLabel: FILTER_LABEL[tombstone.status],
    cause: tombstone.cause.label,
    lastCommit: formatLastCommit(tombstone.daysInactive),
    stars: String(repo.stars),
    ci: CI_TEXT[repo.ciStatus],
  }));
}
