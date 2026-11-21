import { z } from "zod";

export const GitHubRepoSchema = z.object({
  name: z.string().min(1),
  html_url: z.url(),
  description: z.string().nullable(),
  fork: z.boolean(),
  archived: z.boolean(),
  stargazers_count: z.number().int().nonnegative(),
  open_issues_count: z.number().int().nonnegative(),
  language: z.string().nullable(),
  pushed_at: z.iso.datetime({ offset: true }).nullable(),
  default_branch: z.string().min(1),
  owner: z.object({ login: z.string().min(1) }),
});
export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

export const CommitListSchema = z.array(
  z.object({
    commit: z.object({
      committer: z.object({ date: z.iso.datetime({ offset: true }) }).nullable(),
    }),
  }),
);
export type CommitList = z.infer<typeof CommitListSchema>;

export const CheckRunsSchema = z.object({
  total_count: z.number().int().nonnegative(),
  check_runs: z.array(z.object({ conclusion: z.string().nullable() })),
});
export type CheckRuns = z.infer<typeof CheckRunsSchema>;

export const ReadmeSchema = z.object({ name: z.string() });
export type Readme = z.infer<typeof ReadmeSchema>;
