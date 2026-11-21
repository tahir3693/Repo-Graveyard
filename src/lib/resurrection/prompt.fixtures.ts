import type { ContextBundle } from "./context";

export function makeBundle(overrides: Partial<ContextBundle> = {}): ContextBundle {
  return {
    name: "todo-app",
    description: "A todo app",
    language: "TypeScript",
    status: "dead",
    causeCode: "archived",
    causeLabel: "Archived",
    daysInactive: 412,
    stars: 3,
    openIssues: 1,
    archived: false,
    outdatedDeps: null,
    ci: { state: "failing", failingChecks: ["build"] },
    readme: "# Todo\nPlain readme.",
    readmeTruncated: false,
    fileTree: ["README.md", "src/"],
    commitMessages: ["initial commit"],
    openIssueTitles: ["Add dark mode"],
    unavailable: [],
    ...overrides,
  };
}
