/**
 * Fixtures for the demo path. Shapes follow the auth-ingestion scan response
 * (mode, repos, skippedForks, skippedInvalid, truncated) and the resurrection
 * route response (plan, source).
 */

/** The browser clock is pinned to this instant, so statuses never drift with the calendar. */
export const FIXED_NOW = new Date("2026-11-20T12:00:00Z");

interface DemoRepo {
  name: string;
  url: string;
  description: string | null;
  lastCommitAt: string | null;
  openIssues: number;
  archived: boolean;
  ciStatus: "passing" | "failing" | "none";
  hasReadme: boolean;
  outdatedDeps: boolean | null;
  stars: number;
  language: string | null;
}

const repo = (partial: Partial<DemoRepo> & { name: string }): DemoRepo => ({
  url: `https://github.com/demo-user/${partial.name}`,
  description: null,
  lastCommitAt: null,
  openIssues: 0,
  archived: false,
  ciStatus: "none",
  hasReadme: true,
  outdatedDeps: false,
  stars: 0,
  language: "TypeScript",
  ...partial,
});

export const DEMO_REPOS: DemoRepo[] = [
  // Active: committed 5 days before FIXED_NOW.
  repo({
    name: "fresh-start",
    lastCommitAt: "2026-11-15T12:00:00Z",
    ciStatus: "passing",
    stars: 12,
  }),
  // Idle for a while, with red CI, a stale dependency tree and no README.
  repo({
    name: "todo-app",
    lastCommitAt: "2026-05-01T12:00:00Z",
    ciStatus: "failing",
    outdatedDeps: true,
    hasReadme: false,
    openIssues: 4,
    stars: 3,
    description: "A todo list that was never quite finished.",
  }),
  // Silent for a year and a half.
  repo({
    name: "old-blog-engine",
    lastCommitAt: "2025-05-01T12:00:00Z",
    outdatedDeps: true,
    stars: 140,
    language: "JavaScript",
  }),
  // Archived on purpose.
  repo({
    name: "retired-cli",
    lastCommitAt: "2024-02-01T12:00:00Z",
    archived: true,
    stars: 1000,
    language: "Go",
  }),
];

export const DEMO_SCAN_RESPONSE = {
  mode: "demo" as const,
  repos: DEMO_REPOS,
  skippedForks: 0,
  skippedInvalid: 0,
  truncated: false,
};

/** The repo the test opens and resurrects. */
export const TARGET_REPO = "todo-app";

/** The wire shape of /api/resurrect. The drawer shows roadmap[0].action as the smallest next step. */
export const MOCK_PLAN = {
  verdict: {
    decision: "revive" as const,
    reason: "Quiet for a long while, yet one small step can wake it.",
  },
  diagnosis:
    "Paused after the dependencies drifted out of date. Nothing here is broken beyond repair.",
  roadmap: [
    {
      title: "List the outdated dependencies",
      action: "Bump the dependencies, run the tests, and fix the first red one.",
      effort: "15 min",
      why: "A short list turns a vague worry into a first target.",
    },
    {
      title: "Update one dependency",
      action: "Update that one package and run the project.",
      effort: "1 hour",
      why: "One package at a time keeps breakage easy to trace.",
    },
    {
      title: "Run it once",
      action: "Run the project once and add one README line.",
      effort: "15 min",
      why: "A single run shows what survived the silence.",
    },
  ],
  quickWins: ["Update one outdated dependency.", "Add one README line."],
  risks: ["Updating can break the build, so go one package at a time."],
  effort: { level: "medium" as const, total: "about a day" },
  issue: {
    title: "Revive todo-app: update dependencies",
    body: "Start with the lockfile, then re-run CI and fix whatever turns red first.\n\n- [ ] List the outdated dependencies\n- [ ] Update one dependency\n- [ ] Run it once",
    labels: ["revival", "dependencies"],
  },
};

export const MOCK_RESURRECT_RESPONSE = {
  plan: MOCK_PLAN,
  source: "ai" as const,
};
