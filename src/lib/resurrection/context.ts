import { z } from "zod";

import { CAUSE_CODES } from "@/lib/epitaphs";
import { deriveCiStatus } from "@/lib/github/derive";
import { toRepoHealth } from "@/lib/github/map";
import type { RepoHealth } from "@/lib/github/repo-health";
import type { GitHubRepo } from "@/lib/github/schemas";
import { compareCodePoint } from "@/lib/github/sort";
import type { Tombstone } from "@/lib/scoring";

import { RESURRECTION_LIMITS as L } from "./limits";
import { capText, codePointLength, firstLine, sanitizeText } from "./text";

export const CONTEXT_FIELDS = [
  "readme",
  "fileTree",
  "commitMessages",
  "ci",
  "openIssueTitles",
] as const;

export const ContextBundleSchema = z.strictObject({
  name: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  status: z.enum(["alive", "dying", "dead", "ancient"]),
  causeCode: z.enum(CAUSE_CODES),
  causeLabel: z.string(),
  daysInactive: z.number().int().nonnegative().nullable(),
  stars: z.number().int().nonnegative(),
  openIssues: z.number().int().nonnegative(),
  archived: z.boolean(),
  outdatedDeps: z.boolean().nullable(),
  ci: z.strictObject({
    state: z.enum(["passing", "failing", "none"]),
    failingChecks: z.array(z.string()),
  }),
  readme: z.string(),
  readmeTruncated: z.boolean(),
  fileTree: z.array(z.string()),
  commitMessages: z.array(z.string()),
  openIssueTitles: z.array(z.string()),
  unavailable: z.array(z.enum(CONTEXT_FIELDS)),
});
export type ContextBundle = z.infer<typeof ContextBundleSchema>;

/**
 * Raw reads from GitHub. `null` means the read was unavailable.
 * `outdatedDeps` is the already-derived result of auth-ingestion's
 * `lookupOutdatedDeps` (see gather.ts), not a manifest date.
 */
export type RawContext = {
  repo: GitHubRepo;
  readme: string | null;
  tree: Array<{ path: string; type: string }> | null;
  commits: Array<{ message: string; date: string | null }> | null;
  checks: Array<{ name: string; conclusion: string | null }> | null;
  issues: Array<{ title: string }> | null;
  outdatedDeps: boolean | null;
};

const FAILING_CONCLUSIONS: ReadonlySet<string> = new Set(["failure", "timed_out", "startup_failure"]);

function sliceCodePoints(text: string, count: number): string {
  return Array.from(text).slice(0, count).join("");
}

export function buildFileTree(entries: ReadonlyArray<{ path: string; type: string }>): string[] {
  return entries
    .map((entry) => ({ path: sanitizeText(entry.path), type: entry.type }))
    .filter((entry) => entry.path !== "" && !entry.path.includes("/"))
    .map((entry) => (entry.type === "tree" ? `${entry.path}/` : entry.path))
    .sort(compareCodePoint)
    .slice(0, L.CAP_TREE_ENTRIES)
    .map((entry) => capText(entry, L.CAP_TREE_ENTRY));
}

export function buildCommitMessages(messages: readonly string[]): string[] {
  return messages
    .slice(0, L.CAP_COMMITS)
    .map((message) => capText(firstLine(message), L.CAP_COMMIT));
}

export function buildIssueTitles(titles: readonly string[]): string[] {
  return titles
    .map((title) => capText(title, L.CAP_ISSUE_TITLE))
    .filter((title) => title !== "")
    .slice(0, L.CAP_ISSUE_TITLES);
}

function buildFailingChecks(checks: ReadonlyArray<{ name: string; conclusion: string | null }>): string[] {
  return checks
    .filter((check) => check.conclusion !== null && FAILING_CONCLUSIONS.has(check.conclusion))
    .map((check) => capText(check.name, L.CAP_CHECK_NAME))
    .slice(0, L.CAP_FAILING_CHECKS);
}

/** Builds the trusted `RepoHealth` from the raw reads. `now` is not read here; outdated deps are already derived. */
export function deriveRepoHealth(raw: RawContext, now: Date): RepoHealth {
  void now;
  const newest = raw.commits === null ? undefined : raw.commits[0];
  let lastCommitAt: string | null;
  if (raw.commits === null) lastCommitAt = raw.repo.pushed_at;
  else if (newest === undefined) lastCommitAt = null;
  else lastCommitAt = newest.date ?? raw.repo.pushed_at;

  return toRepoHealth(raw.repo, {
    lastCommitAt,
    ciStatus: raw.checks === null ? "none" : deriveCiStatus(raw.checks.map((c) => c.conclusion)),
    hasReadme: raw.readme !== null && raw.readme !== "",
    outdatedDeps: raw.outdatedDeps,
  });
}

function unavailableFields(raw: RawContext): ContextBundle["unavailable"] {
  const missing: ContextBundle["unavailable"] = [];
  if (raw.readme === null) missing.push("readme");
  if (raw.tree === null) missing.push("fileTree");
  if (raw.commits === null) missing.push("commitMessages");
  if (raw.checks === null) missing.push("ci");
  if (raw.issues === null) missing.push("openIssueTitles");
  return missing;
}

export function capBundle(raw: RawContext, tombstone: Tombstone, health: RepoHealth): ContextBundle {
  const readmeText = raw.readme ?? "";
  const bundle: ContextBundle = {
    name: capText(health.name, L.CAP_NAME),
    description: health.description === null ? null : capText(health.description, L.CAP_DESCRIPTION),
    language: health.language === null ? null : capText(health.language, L.CAP_LANGUAGE),
    status: tombstone.status,
    causeCode: tombstone.cause.code,
    causeLabel: tombstone.cause.label,
    daysInactive: tombstone.daysInactive,
    stars: health.stars,
    openIssues: health.openIssues,
    archived: health.archived,
    outdatedDeps: health.outdatedDeps,
    ci: {
      state: health.ciStatus,
      failingChecks: raw.checks === null ? [] : buildFailingChecks(raw.checks),
    },
    readme: capText(readmeText, L.CAP_README),
    readmeTruncated: codePointLength(sanitizeText(readmeText)) > L.CAP_README,
    fileTree: raw.tree === null ? [] : buildFileTree(raw.tree),
    commitMessages: raw.commits === null ? [] : buildCommitMessages(raw.commits.map((c) => c.message)),
    openIssueTitles: raw.issues === null ? [] : buildIssueTitles(raw.issues.map((i) => i.title)),
    unavailable: unavailableFields(raw),
  };

  // Bounded guard: the README halves until the bundle fits, so it ends at "".
  while (JSON.stringify(bundle).length > L.CAP_SERIALIZED && bundle.readme !== "") {
    bundle.readme = sliceCodePoints(bundle.readme, Math.floor(codePointLength(bundle.readme) / 2));
    bundle.readmeTruncated = true;
  }
  return bundle;
}
