import fc from "fast-check";
import type { RepoHealth } from "../repo-health";

const isoDate = fc
  .date({ min: new Date("2000-01-01T00:00:00Z"), max: new Date("2030-01-01T00:00:00Z"), noInvalidDate: true })
  .map((d) => d.toISOString());

const nonEmptyText = fc.stringMatching(/^[A-Za-z0-9._-]{1,40}$/);
const nullableText = fc.option(fc.string({ maxLength: 80 }), { nil: null });
const count = fc.nat({ max: 1_000_000 });

export const repoHealthArb: fc.Arbitrary<RepoHealth> = fc.record({
  name: nonEmptyText,
  url: nonEmptyText.map((n) => `https://github.com/octocat/${n}`),
  description: nullableText,
  lastCommitAt: fc.option(isoDate, { nil: null }),
  openIssues: count,
  archived: fc.boolean(),
  ciStatus: fc.constantFrom("passing", "failing", "none"),
  hasReadme: fc.boolean(),
  outdatedDeps: fc.option(fc.boolean(), { nil: null }),
  stars: count,
  language: fc.option(nonEmptyText, { nil: null }),
});

export interface GitHubRepoPayload {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  stargazers_count: number;
  open_issues_count: number;
  language: string | null;
  pushed_at: string | null;
  default_branch: string;
  owner: { login: string };
}

export const validGitHubRepoArb: fc.Arbitrary<GitHubRepoPayload> = fc
  .record({
    owner: nonEmptyText,
    name: nonEmptyText,
    description: nullableText,
    fork: fc.boolean(),
    archived: fc.boolean(),
    stargazers_count: count,
    open_issues_count: count,
    language: fc.option(nonEmptyText, { nil: null }),
    pushed_at: fc.option(isoDate, { nil: null }),
    default_branch: nonEmptyText,
  })
  .map(({ owner, name, ...rest }) => ({
    name,
    full_name: `${owner}/${name}`,
    html_url: `https://github.com/${owner}/${name}`,
    owner: { login: owner },
    ...rest,
  }));

type MutableRepo = Record<string, unknown>;

const invalidMutations: fc.Arbitrary<(repo: MutableRepo) => MutableRepo> = fc.oneof(
  fc.constantFrom(
    "name",
    "html_url",
    "description",
    "fork",
    "archived",
    "stargazers_count",
    "open_issues_count",
    "language",
    "pushed_at",
    "default_branch",
    "owner",
  ).map((key) => (repo: MutableRepo) => {
    const { [key]: _removed, ...rest } = repo;
    void _removed;
    return rest;
  }),
  fc.constantFrom(-1, 1.5, "3", null).map((v) => (repo: MutableRepo) => ({ ...repo, stargazers_count: v })),
  fc.constantFrom(-1, 2.5, "3", null).map((v) => (repo: MutableRepo) => ({ ...repo, open_issues_count: v })),
  fc.constantFrom("", "not a url", 5, null).map((v) => (repo: MutableRepo) => ({ ...repo, html_url: v })),
  fc.constantFrom("", 5, null).map((v) => (repo: MutableRepo) => ({ ...repo, name: v })),
  fc.constantFrom("yesterday", "2024-13-45", 5).map((v) => (repo: MutableRepo) => ({ ...repo, pushed_at: v })),
  fc.constantFrom(null, "octocat", {}, { login: "" }).map((v) => (repo: MutableRepo) => ({ ...repo, owner: v })),
);

/** A repo payload that fails GitHubRepoSchema in at least one field. */
export const invalidGitHubRepoArb: fc.Arbitrary<unknown> = fc
  .tuple(validGitHubRepoArb, invalidMutations)
  .map(([repo, mutate]) => mutate({ ...repo }));
