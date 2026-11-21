import { Octokit } from "octokit";
import { z } from "zod";

export type GitHubResponse = {
  status: number;
  headers: Record<string, string | undefined>;
  data: unknown;
};

export type GitHubRequester = (
  route: string,
  params: Record<string, unknown>,
) => Promise<GitHubResponse>;

export const REQUEST_TIMEOUT_MS = 10_000;

function noop(): void {}

const SILENT_LOGGER = { debug: noop, info: noop, warn: noop, error: noop };

function normalizeHeaders(
  headers: Record<string, string | number | undefined>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(headers)) {
    result[name.toLowerCase()] = value === undefined ? undefined : String(value);
  }
  return result;
}

/**
 * Reads the optional server-only `GITHUB_API_BASE_URL` override (used by tests
 * to point at a local mock). Returns `null` unless it is a valid http(s) URL.
 */
export function readGitHubApiBaseUrl(env: Record<string, string | undefined>): string | null {
  const value = env.GITHUB_API_BASE_URL?.trim();
  if (!value) return null;
  const parsed = z.url({ protocol: /^https?$/ }).safeParse(value);
  return parsed.success ? value.replace(/\/+$/, "") : null;
}

export function createOctokitRequester(
  token: string | null,
  baseUrl: string | null = null,
): GitHubRequester {
  const octokit = new Octokit({
    ...(token === null ? {} : { auth: token }),
    ...(baseUrl === null ? {} : { baseUrl }),
    throttle: { enabled: false },
    retry: { enabled: false },
    log: SILENT_LOGGER,
  });

  octokit.hook.wrap("request", (request, options) =>
    request({
      ...options,
      request: { ...options.request, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    }),
  );

  return async (route, params) => {
    // Defense in depth: the ingestion layer is read-only.
    if (!route.startsWith("GET ")) {
      throw new Error("Only GET requests are allowed");
    }
    const response = await octokit.request(route, params);
    return {
      status: response.status,
      headers: normalizeHeaders(response.headers),
      data: response.data,
    };
  };
}
