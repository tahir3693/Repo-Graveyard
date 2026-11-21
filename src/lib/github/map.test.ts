import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toRepoHealth, type RepoDetails } from "./map";
import { RepoHealthSchema } from "./repo-health";
import { GitHubRepoSchema } from "./schemas";
import { validGitHubRepoArb } from "./test-utils/arbitraries";

const repo = GitHubRepoSchema.parse({
  name: "crypt",
  html_url: "https://github.com/octocat/crypt",
  description: "A repo",
  fork: false,
  archived: true,
  stargazers_count: 7,
  open_issues_count: 3,
  language: "TypeScript",
  pushed_at: "2024-01-01T00:00:00Z",
  default_branch: "main",
  owner: { login: "octocat" },
});

const details: RepoDetails = {
  lastCommitAt: "2024-02-02T00:00:00.000Z",
  ciStatus: "failing",
  hasReadme: true,
  outdatedDeps: false,
};

describe("toRepoHealth", () => {
  it("maps every field", () => {
    expect(toRepoHealth(repo, details)).toEqual({
      name: "crypt",
      url: "https://github.com/octocat/crypt",
      description: "A repo",
      lastCommitAt: "2024-02-02T00:00:00.000Z",
      openIssues: 3,
      archived: true,
      ciStatus: "failing",
      hasReadme: true,
      outdatedDeps: false,
      stars: 7,
      language: "TypeScript",
    });
  });

  it("keeps lastCommitAt null", () => {
    const out = toRepoHealth(repo, { ...details, lastCommitAt: null });
    expect(out.lastCommitAt).toBeNull();
    expect(RepoHealthSchema.safeParse(out).success).toBe(true);
  });

  it("always produces a RepoHealthSchema-valid object", () => {
    fc.assert(
      fc.property(
        validGitHubRepoArb,
        fc.constantFrom("passing", "failing", "none"),
        fc.boolean(),
        fc.option(fc.boolean(), { nil: null }),
        (payload, ciStatus, hasReadme, outdatedDeps) => {
          const parsed = GitHubRepoSchema.parse(payload);
          const out = toRepoHealth(parsed, { lastCommitAt: null, ciStatus, hasReadme, outdatedDeps });
          return RepoHealthSchema.safeParse(out).success;
        },
      ),
      { numRuns: 100 },
    );
  });
});
