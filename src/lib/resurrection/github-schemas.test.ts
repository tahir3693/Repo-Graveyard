import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import {
  CheckRunsListSchema,
  IssueCreatedSchema,
  OpenIssuesSchema,
  RawReadmeSchema,
  RecentCommitsSchema,
  RepoWithIssuesSchema,
  TreeSchema,
} from "./github-schemas";

const repo = {
  name: "todo-app",
  html_url: "https://github.com/octo/todo-app",
  description: null,
  fork: false,
  archived: false,
  stargazers_count: 3,
  open_issues_count: 1,
  language: "TypeScript",
  pushed_at: "2023-03-01T00:00:00Z",
  default_branch: "main",
  owner: { login: "octo" },
};

const cases: ReadonlyArray<{ name: string; schema: ZodType; valid: unknown; invalid: unknown }> = [
  { name: "readme", schema: RawReadmeSchema, valid: "# Hello", invalid: { content: "x" } },
  {
    name: "tree",
    schema: TreeSchema,
    valid: { tree: [{ path: "src", type: "tree" }] },
    invalid: { tree: [{ path: "src" }] },
  },
  {
    name: "commits",
    schema: RecentCommitsSchema,
    valid: [
      { commit: { message: "init", committer: { date: "2023-03-01T00:00:00Z" } } },
      { commit: { message: "no date", committer: null } },
    ],
    invalid: [{ commit: { committer: null } }],
  },
  {
    name: "check runs",
    schema: CheckRunsListSchema,
    valid: { check_runs: [{ name: "ci", conclusion: null }] },
    invalid: { check_runs: [{ conclusion: "success" }] },
  },
  {
    name: "open issues",
    schema: OpenIssuesSchema,
    valid: [{ title: "Bug" }, { title: "PR", pull_request: { url: "x" } }],
    invalid: [{ number: 1 }],
  },
  {
    name: "issue creation",
    schema: IssueCreatedSchema,
    valid: { number: 7, html_url: "https://github.com/octo/todo-app/issues/7" },
    invalid: { number: "7", html_url: "https://github.com/octo/todo-app/issues/7" },
  },
  {
    name: "repo with issues",
    schema: RepoWithIssuesSchema,
    valid: { ...repo, has_issues: true },
    invalid: repo,
  },
];

describe.each(cases)("$name schema", ({ schema, valid, invalid }) => {
  it("accepts a valid payload", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid payload", () => {
    expect(schema.safeParse(invalid).success).toBe(false);
  });

  it("fails null input without throwing", () => {
    expect(() => schema.safeParse(null)).not.toThrow();
    expect(schema.safeParse(null).success).toBe(false);
  });
});

describe("RawReadmeSchema limit", () => {
  it("accepts 2,000,000 characters and rejects one more", () => {
    expect(RawReadmeSchema.safeParse("a".repeat(2_000_000)).success).toBe(true);
    expect(RawReadmeSchema.safeParse("a".repeat(2_000_001)).success).toBe(false);
  });
});
