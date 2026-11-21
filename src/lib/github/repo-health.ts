import { z } from "zod";

export const RepoHealthSchema = z.strictObject({
  name: z.string().min(1),
  url: z.url(),
  description: z.string().nullable(),
  lastCommitAt: z.iso.datetime({ offset: true }).nullable(),
  openIssues: z.number().int().nonnegative(),
  archived: z.boolean(),
  ciStatus: z.enum(["passing", "failing", "none"]),
  hasReadme: z.boolean(),
  outdatedDeps: z.boolean().nullable(),
  stars: z.number().int().nonnegative(),
  language: z.string().nullable(),
});

export type RepoHealth = z.infer<typeof RepoHealthSchema>;
