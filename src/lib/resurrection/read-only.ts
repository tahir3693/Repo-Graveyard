import type { GitHubRequester, GitHubResponse } from "@/lib/github/requester";

export type ReadRoute = `GET ${string}`;

export type ReadRequester = (
  route: ReadRoute,
  params: Record<string, unknown>,
) => Promise<GitHubResponse>;

export function isReadRoute(route: string): route is ReadRoute {
  return typeof route === "string" && route.startsWith("GET ");
}

/**
 * Wraps a requester so any non-GET route throws before the inner requester is
 * called. Defense in depth: /api/resurrect never writes to GitHub.
 */
export function readOnly(requester: GitHubRequester): ReadRequester {
  return (route: string, params) => {
    if (!isReadRoute(route)) {
      throw new Error("read-only requester");
    }
    return requester(route, params);
  };
}
