import { z } from "zod";

import { GitHubRepoSchema } from "@/lib/github/schemas";

export const README_RAW_MAX_CHARS = 2_000_000;

export const RawReadmeSchema = z.string().max(README_RAW_MAX_CHARS);

export const TreeSchema = z.object({
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
});
export type Tree = z.infer<typeof TreeSchema>;

export const RecentCommitsSchema = z.array(
  z.object({
    commit: z.object({
      message: z.string(),
      committer: z.object({ date: z.iso.datetime({ offset: true }) }).nullable(),
    }),
  }),
);
export type RecentCommits = z.infer<typeof RecentCommitsSchema>;

export const CheckRunsListSchema = z.object({
  check_runs: z.array(
    z.object({ name: z.string(), conclusion: z.string().nullable() }),
  ),
});
export type CheckRunsList = z.infer<typeof CheckRunsListSchema>;

export const OpenIssuesSchema = z.array(
  z.object({
    title: z.string(),
    pull_request: z.unknown().optional(),
  }),
);
export type OpenIssues = z.infer<typeof OpenIssuesSchema>;

export const IssueCreatedSchema = z.object({
  number: z.number().int().positive(),
  html_url: z.string().min(1),
});
export type IssueCreated = z.infer<typeof IssueCreatedSchema>;

export const RepoWithIssuesSchema = GitHubRepoSchema.extend({
  has_issues: z.boolean(),
});
export type RepoWithIssues = z.infer<typeof RepoWithIssuesSchema>;
