import { GitHubRepoSchema, type GitHubRepo } from "./schemas";

export type SplitResult = { ok: true; repos: GitHubRepo[]; skippedInvalid: number } | { ok: false };

/** Parses every entry; drops invalid ones. Fails on a non-array or a non-empty all-invalid list. */
export function splitValidEntries(items: unknown): SplitResult {
  if (!Array.isArray(items)) return { ok: false };
  const repos: GitHubRepo[] = [];
  let skippedInvalid = 0;
  for (const entry of items) {
    const parsed = GitHubRepoSchema.safeParse(entry);
    if (parsed.success) repos.push(parsed.data);
    else skippedInvalid += 1;
  }
  if (items.length > 0 && repos.length === 0) return { ok: false };
  return { ok: true, repos, skippedInvalid };
}
