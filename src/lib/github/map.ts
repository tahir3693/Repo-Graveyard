import type { CiStatus } from "./derive";
import type { RepoHealth } from "./repo-health";
import type { GitHubRepo } from "./schemas";

export type RepoDetails = {
  lastCommitAt: string | null;
  ciStatus: CiStatus;
  hasReadme: boolean;
  outdatedDeps: boolean | null;
};

/** Pure field mapping from a validated GitHub repo plus its details. */
export function toRepoHealth(repo: GitHubRepo, details: RepoDetails): RepoHealth {
  return {
    name: repo.name,
    url: repo.html_url,
    description: repo.description,
    lastCommitAt: details.lastCommitAt,
    openIssues: repo.open_issues_count,
    archived: repo.archived,
    ciStatus: details.ciStatus,
    hasReadme: details.hasReadme,
    outdatedDeps: details.outdatedDeps,
    stars: repo.stargazers_count,
    language: repo.language,
  };
}
