/**
 * Pure text for the drawer's facts row. Every fact is a label and a plain-text value, so
 * nothing relies on color alone. `tone: "warn"` only adds emphasis on top of the text.
 */
import type { ScannedRepo } from "@/lib/graveyard/client";
import type { Tombstone } from "@/lib/scoring";

export type DrawerFact = {
  key: "lastCommit" | "stars" | "ci" | "deps" | "issues";
  label: string;
  value: string;
  tone: "normal" | "warn";
};

/** "Today", "6 days ago", "5 months ago", "2 years ago", or a note when there are no commits. */
export function formatLastCommit(daysInactive: number | null): string {
  if (daysInactive === null) return "No commits found";
  if (daysInactive <= 0) return "Today";
  if (daysInactive === 1) return "Yesterday";
  if (daysInactive < 60) return `${daysInactive} days ago`;
  if (daysInactive < 730) return `${Math.floor(daysInactive / 30)} months ago`;
  return `${Math.floor(daysInactive / 365)} years ago`;
}

const CI_TEXT: Record<ScannedRepo["ciStatus"], string> = {
  passing: "Passing",
  failing: "Failing",
  none: "No CI",
};

function depsText(outdated: boolean | null): string {
  if (outdated === null) return "Unknown";
  return outdated ? "Outdated" : "Up to date";
}

export function buildDrawerFacts(repo: ScannedRepo, tombstone: Tombstone): DrawerFact[] {
  return [
    { key: "lastCommit", label: "Last commit", value: formatLastCommit(tombstone.daysInactive), tone: "normal" },
    { key: "stars", label: "Stars", value: String(repo.stars), tone: "normal" },
    {
      key: "ci",
      label: "CI",
      value: CI_TEXT[repo.ciStatus],
      tone: repo.ciStatus === "failing" ? "warn" : "normal",
    },
    {
      key: "deps",
      label: "Dependencies",
      value: depsText(repo.outdatedDeps),
      tone: repo.outdatedDeps === true ? "warn" : "normal",
    },
    { key: "issues", label: "Open issues", value: String(repo.openIssues), tone: "normal" },
  ];
}
