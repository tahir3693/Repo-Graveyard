export const PAGE_SIZE = 100;
export const REPO_LIMIT = 300;

export type RepoPage = { items: unknown[]; hasNext: boolean };

const NEXT_LINK = /<[^<>]*>\s*;(?:[^,]*;)?\s*rel\s*=\s*"?(?:[^",]*\s)?next(?:\s[^",]*)?"?\s*(?:[;,]|$)/i;

/** True when a GitHub `Link` header advertises a `rel="next"` page. Malformed input gives false. */
export function parseHasNextPage(linkHeader: string | undefined): boolean {
  if (linkHeader === undefined || linkHeader.trim() === "") {
    return false;
  }
  return NEXT_LINK.test(linkHeader);
}

/**
 * Fetches pages 1, 2, ... until there is no next page or `limit` items are
 * collected. Rejects without partial items if any page rejects.
 */
export async function collectPages(
  fetchPage: (page: number) => Promise<RepoPage>,
  limit: number = REPO_LIMIT,
): Promise<{ items: unknown[]; truncated: boolean }> {
  const collected: unknown[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext && collected.length < limit) {
    const result = await fetchPage(page);
    collected.push(...result.items);
    hasNext = result.hasNext;
    page += 1;
  }

  const truncated = collected.length > limit || (collected.length >= limit && hasNext);
  return { items: collected.slice(0, limit), truncated };
}
