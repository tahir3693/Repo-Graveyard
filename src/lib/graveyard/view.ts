/**
 * Pure helpers for the graveyard page: status counts, the summary line, filtering and
 * sorting. No I/O and no clock reads. Status and cause always come from `scoreRepo`.
 */
import type { Status } from "@/lib/scoring";
import type { GraveEntry } from "@/lib/graveyard/tombstones";

export const STATUS_ORDER = ["alive", "dying", "dead", "ancient"] as const satisfies readonly Status[];

export const FILTERS = ["all", ...STATUS_ORDER] as const;
export type Filter = (typeof FILTERS)[number];

export const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  alive: "Alive",
  dying: "Dying",
  dead: "Dead",
  ancient: "Ancient",
};

export const SORT_KEYS = ["newest", "oldest", "stars"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest activity",
  oldest: "Oldest activity",
  stars: "Most stars",
};

export type StatusCounts = Record<Status, number> & { total: number };

export function countByStatus(entries: readonly GraveEntry[]): StatusCounts {
  const counts: StatusCounts = { alive: 0, dying: 0, dead: 0, ancient: 0, total: 0 };
  for (const entry of entries) {
    counts[entry.tombstone.status] += 1;
    counts.total += 1;
  }
  return counts;
}

/** "12 repos: 3 alive, 4 dying, 3 dead, 2 ancient". Every status is listed, even at zero. */
export function summaryText(counts: StatusCounts): string {
  if (counts.total === 0) return "No repos yet";
  const noun = counts.total === 1 ? "repo" : "repos";
  const parts = STATUS_ORDER.map((status) => `${counts[status]} ${status}`);
  return `${counts.total} ${noun}: ${parts.join(", ")}`;
}

export function filterEntries(entries: readonly GraveEntry[], filter: Filter): GraveEntry[] {
  if (filter === "all") return [...entries];
  return entries.filter((entry) => entry.tombstone.status === filter);
}

/** Milliseconds since epoch of the last commit, or null when the repo has none. */
function activityOf(entry: GraveEntry): number | null {
  const iso = entry.repo.lastCommitAt;
  if (iso === null) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

function byName(a: GraveEntry, b: GraveEntry): number {
  return a.repo.name.localeCompare(b.repo.name, "en");
}

/**
 * Returns a sorted copy. A repo with no commits counts as the oldest activity.
 * Ties fall back to the repo name, so the order is stable and repeatable.
 */
export function sortEntries(entries: readonly GraveEntry[], key: SortKey): GraveEntry[] {
  const copy = [...entries];
  if (key === "stars") {
    return copy.sort((a, b) => b.repo.stars - a.repo.stars || byName(a, b));
  }
  const direction = key === "newest" ? -1 : 1;
  return copy.sort((a, b) => {
    const x = activityOf(a) ?? Number.NEGATIVE_INFINITY;
    const y = activityOf(b) ?? Number.NEGATIVE_INFINITY;
    if (x === y) return byName(a, b);
    // Newest first means the larger time comes first, so an older repo sorts after.
    return x < y ? -direction : direction;
  });
}

export function isFilter(value: string): value is Filter {
  return (FILTERS as readonly string[]).includes(value);
}

export function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

/** "Showing 4 of 12 repos", announced politely when the filter changes. */
export function resultsText(shown: number, total: number): string {
  const noun = total === 1 ? "repo" : "repos";
  return `Showing ${shown} of ${total} ${noun}`;
}

/** "3 repos could not be read", or null when none were skipped. Always plain text. */
export function skippedText(skipped: number): string | null {
  if (!Number.isInteger(skipped) || skipped <= 0) return null;
  return skipped === 1 ? "1 repo could not be read" : `${skipped} repos could not be read`;
}