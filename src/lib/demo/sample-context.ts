/**
 * Bundled context for the sample repos, so a revival plan can be built with no GitHub call.
 * All text here is invented fixture data. It still goes through the same caps, sanitizing and
 * prompt escaping as real repo content, because it enters the shared `capBundle` path.
 * Pure: no I/O, no clock reads. `now` is passed in.
 */
import type { RawContext } from "@/lib/resurrection/context";
import { getSampleRepos } from "./sample-repos";

const SAMPLE_OWNER = "sample-graveyard";

/** True only for a name in the bundled sample list. Exact match, no prototype lookups. */
export function isSampleRepoName(name: string, now: Date): boolean {
  return getSampleRepos(now).some((repo) => repo.name === name);
}

/** The bundled raw context for one sample repo, or null when the name is not in the list. */
export function getSampleContext(name: string, now: Date): RawContext | null {
  const repo = getSampleRepos(now).find((candidate) => candidate.name === name);
  if (repo === undefined) return null;
  const description = repo.description ?? "A sample project.";
  return {
    repo: {
      name: repo.name,
      html_url: repo.url,
      description: repo.description,
      fork: false,
      archived: repo.archived,
      stargazers_count: repo.stars,
      open_issues_count: repo.openIssues,
      language: repo.language,
      pushed_at: repo.lastCommitAt,
      default_branch: "main",
      owner: { login: SAMPLE_OWNER },
    },
    readme: `# ${repo.name}\n\n${description}\n\n## Status\n\nThis is a sample project for the demo graveyard.\n`,
    tree: [
      { path: "README.md", type: "blob" },
      { path: "LICENSE", type: "blob" },
      { path: "src", type: "tree" },
    ],
    commits: [{ message: "Last commit before the quiet", date: repo.lastCommitAt }],
    checks:
      repo.ciStatus === "failing"
        ? [{ name: "build", conclusion: "failure" }]
        : repo.ciStatus === "passing"
          ? [{ name: "build", conclusion: "success" }]
          : [],
    issues: Array.from({ length: repo.openIssues }, (_unused, index) => ({
      title: `Sample issue ${index + 1}`,
    })),
    outdatedDeps: repo.outdatedDeps,
  };
}
