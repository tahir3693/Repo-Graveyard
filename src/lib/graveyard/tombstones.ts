import { scoreRepo, type Tombstone } from "@/lib/scoring";
import type { ScannedRepo } from "@/lib/graveyard/client";

export type GraveEntry = { repo: ScannedRepo; tombstone: Tombstone };

/**
 * One entry per scanned repo, scored with the deterministic rules in `scoreRepo`.
 * `now` is passed in so the result never depends on a hidden clock read.
 */
export function buildGraveEntries(repos: readonly ScannedRepo[], now: Date): GraveEntry[] {
  return repos.map((repo) => ({ repo, tombstone: scoreRepo(repo, now) }));
}

/** Number of entries whose status is alive. Drives the moon brightness. */
export function countAlive(entries: readonly GraveEntry[]): number {
  return entries.filter((entry) => entry.tombstone.status === "alive").length;
}
