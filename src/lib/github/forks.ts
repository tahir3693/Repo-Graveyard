export function filterForks<T extends { fork: boolean }>(
  repos: readonly T[],
  includeForks: boolean,
): { kept: T[]; skippedForks: number } {
  if (includeForks) return { kept: [...repos], skippedForks: 0 };
  const kept = repos.filter((repo) => !repo.fork);
  return { kept, skippedForks: repos.length - kept.length };
}
