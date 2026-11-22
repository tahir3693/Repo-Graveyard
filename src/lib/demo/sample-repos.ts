/**
 * Bundled sample repos for demo mode. All names are invented. Pure: no I/O, no clock reads,
 * no randomness. The current time is passed in, and each commit date is a fixed number of
 * days before it, so the same `now` always gives the same repos and the same scores.
 */
import type { RepoHealth } from "@/lib/github/repo-health";
import { SCORING_CONSTANTS, scoreRepo, type Tombstone } from "@/lib/scoring";

type SampleSpec = Omit<RepoHealth, "lastCommitAt" | "url"> & { daysAgo: number };

/** Neutral placeholder host. These repos do not exist anywhere. */
const SAMPLE_URL_BASE = "https://example.com/sample-graveyard/";

/**
 * Expected result with the real scoring rules (kept in the tests, not used for scoring):
 * two alive, two dying, three dead and one ancient (the archived repo).
 */
const SAMPLE_SPECS: readonly SampleSpec[] = [
  {
    name: "moonlit-notes",
    description: "A tiny note-taking app that still gets a visit every week.",
    daysAgo: 6,
    openIssues: 1,
    archived: false,
    ciStatus: "passing",
    hasReadme: true,
    outdatedDeps: false,
    stars: 42,
    language: "TypeScript",
  },
  {
    name: "lantern-api",
    description: "A small REST API kept warm by the occasional patch.",
    daysAgo: 20,
    openIssues: 0,
    archived: false,
    ciStatus: "passing",
    hasReadme: true,
    outdatedDeps: false,
    stars: 214,
    language: "Go",
  },
  {
    name: "crypt-keeper-cli",
    description: "A command line tool that tidies old folders.",
    daysAgo: 150,
    openIssues: 1,
    archived: false,
    ciStatus: "failing",
    hasReadme: true,
    outdatedDeps: false,
    stars: 18,
    language: "Rust",
  },
  {
    name: "pale-weather",
    description: "A weather widget waiting on a few dependency updates.",
    daysAgo: 120,
    openIssues: 2,
    archived: false,
    ciStatus: "passing",
    hasReadme: true,
    outdatedDeps: true,
    stars: 7,
    language: "JavaScript",
  },
  {
    name: "ghost-ledger",
    description: "A budgeting tracker with red tests and big plans.",
    daysAgo: 300,
    openIssues: 1,
    archived: false,
    ciStatus: "failing",
    hasReadme: true,
    outdatedDeps: false,
    stars: 3,
    language: "Python",
  },
  {
    name: "bone-tracker",
    description: "A habit tracker whose packages drifted out of date.",
    daysAgo: 330,
    openIssues: 0,
    archived: false,
    ciStatus: "none",
    hasReadme: true,
    outdatedDeps: true,
    stars: 56,
    language: "TypeScript",
  },
  {
    name: "sunken-bell",
    description: "A chat bot with a few unanswered questions.",
    daysAgo: 700,
    openIssues: 4,
    archived: false,
    ciStatus: "none",
    hasReadme: true,
    outdatedDeps: null,
    stars: 9,
    language: "Java",
  },
  {
    name: "old-lighthouse",
    description: "A static site generator, archived with honors.",
    daysAgo: 1100,
    openIssues: 0,
    archived: true,
    ciStatus: "none",
    hasReadme: true,
    outdatedDeps: false,
    stars: 1250,
    language: "Ruby",
  },
];

function isoDaysBefore(now: Date, days: number): string {
  return new Date(now.getTime() - days * SCORING_CONSTANTS.MS_PER_DAY).toISOString();
}

/** The sample repos with commit dates counted back from `now`. */
export function getSampleRepos(now: Date): RepoHealth[] {
  return SAMPLE_SPECS.map(({ daysAgo, ...spec }) => ({
    ...spec,
    url: `${SAMPLE_URL_BASE}${spec.name}`,
    lastCommitAt: isoDaysBefore(now, daysAgo),
  }));
}

/** Each sample repo run through the real `scoreRepo`. */
export function scoreSampleRepos(now: Date): Array<{ repo: RepoHealth; tombstone: Tombstone }> {
  return getSampleRepos(now).map((repo) => ({ repo, tombstone: scoreRepo(repo, now) }));
}
