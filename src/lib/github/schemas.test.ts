import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RepoHealthSchema } from "./repo-health";
import { CheckRunsSchema, CommitListSchema, GitHubRepoSchema, ReadmeSchema } from "./schemas";
import { invalidGitHubRepoArb, repoHealthArb, validGitHubRepoArb } from "./test-utils/arbitraries";

const health = {
  name: "todo-app",
  url: "https://github.com/octocat/todo-app",
  description: null,
  lastCommitAt: "2024-01-02T03:04:05Z",
  openIssues: 2,
  archived: false,
  ciStatus: "passing",
  hasReadme: true,
  outdatedDeps: null,
  stars: 3,
  language: "TypeScript",
};

const repo = {
  name: "todo-app",
  html_url: "https://github.com/octocat/todo-app",
  description: null,
  fork: false,
  archived: false,
  stargazers_count: 3,
  open_issues_count: 1,
  language: null,
  pushed_at: null,
  default_branch: "main",
  owner: { login: "octocat" },
};

describe("RepoHealthSchema", () => {
  it("accepts a valid object", () => {
    expect(RepoHealthSchema.safeParse(health).success).toBe(true);
  });

  it.each(["broken", "", null, 1])("rejects ciStatus %j", (ciStatus) => {
    expect(RepoHealthSchema.safeParse({ ...health, ciStatus }).success).toBe(false);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects count %j", (n) => {
    expect(RepoHealthSchema.safeParse({ ...health, stars: n }).success).toBe(false);
    expect(RepoHealthSchema.safeParse({ ...health, openIssues: n }).success).toBe(false);
  });

  it("rejects missing fields and extra fields", () => {
    const { language: _language, ...missing } = health;
    void _language;
    expect(RepoHealthSchema.safeParse(missing).success).toBe(false);
    expect(RepoHealthSchema.safeParse({ ...health, extra: 1 }).success).toBe(false);
  });

  it.each([null, undefined, "x", 5, []])("fails safely for %j", (input) => {
    expect(RepoHealthSchema.safeParse(input).success).toBe(false);
  });

  it("accepts every generated RepoHealth", () => {
    fc.assert(
      fc.property(repoHealthArb, (value) => RepoHealthSchema.safeParse(value).success),
      { numRuns: 100 },
    );
  });
});

describe("GitHubRepoSchema", () => {
  it("accepts a valid repo and strips unknown keys", () => {
    const result = GitHubRepoSchema.safeParse({ ...repo, id: 7, private: false });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(repo);
  });

  it("rejects negative or fractional counts and missing fields", () => {
    expect(GitHubRepoSchema.safeParse({ ...repo, stargazers_count: -1 }).success).toBe(false);
    expect(GitHubRepoSchema.safeParse({ ...repo, open_issues_count: 1.5 }).success).toBe(false);
    const { owner: _owner, ...missing } = repo;
    void _owner;
    expect(GitHubRepoSchema.safeParse(missing).success).toBe(false);
  });

  it.each([null, undefined, "x", 5, []])("fails safely for %j", (input) => {
    expect(GitHubRepoSchema.safeParse(input).success).toBe(false);
  });

  it("accepts every valid generated payload", () => {
    fc.assert(
      fc.property(validGitHubRepoArb, (value) => GitHubRepoSchema.safeParse(value).success),
      { numRuns: 100 },
    );
  });

  it("rejects every invalid generated payload", () => {
    fc.assert(
      fc.property(invalidGitHubRepoArb, (value) => !GitHubRepoSchema.safeParse(value).success),
      { numRuns: 100 },
    );
  });
});

describe("CommitListSchema", () => {
  it("accepts commits, null committer and an empty list", () => {
    expect(CommitListSchema.safeParse([]).success).toBe(true);
    expect(
      CommitListSchema.safeParse([{ sha: "a", commit: { committer: { date: "2024-01-02T03:04:05Z" } } }]).success,
    ).toBe(true);
    expect(CommitListSchema.safeParse([{ commit: { committer: null } }]).success).toBe(true);
  });

  it("rejects bad dates, missing commit and non-arrays", () => {
    expect(CommitListSchema.safeParse([{ commit: { committer: { date: "yesterday" } } }]).success).toBe(false);
    expect(CommitListSchema.safeParse([{}]).success).toBe(false);
    expect(CommitListSchema.safeParse(null).success).toBe(false);
    expect(CommitListSchema.safeParse({}).success).toBe(false);
  });
});

describe("CheckRunsSchema", () => {
  it("accepts valid check runs", () => {
    expect(
      CheckRunsSchema.safeParse({ total_count: 2, check_runs: [{ conclusion: "success" }, { conclusion: null }] })
        .success,
    ).toBe(true);
  });

  it("rejects bad counts, missing fields and null", () => {
    expect(CheckRunsSchema.safeParse({ total_count: -1, check_runs: [] }).success).toBe(false);
    expect(CheckRunsSchema.safeParse({ total_count: 1.5, check_runs: [] }).success).toBe(false);
    expect(CheckRunsSchema.safeParse({ total_count: 0 }).success).toBe(false);
    expect(CheckRunsSchema.safeParse({ total_count: 1, check_runs: [{ conclusion: 5 }] }).success).toBe(false);
    expect(CheckRunsSchema.safeParse(null).success).toBe(false);
  });
});

describe("ReadmeSchema", () => {
  it("accepts an object with a name and rejects others", () => {
    expect(ReadmeSchema.safeParse({ name: "README.md", size: 10 }).success).toBe(true);
    expect(ReadmeSchema.safeParse({}).success).toBe(false);
    expect(ReadmeSchema.safeParse(null).success).toBe(false);
    expect(ReadmeSchema.safeParse("README.md").success).toBe(false);
  });
});
