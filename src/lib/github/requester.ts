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

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/**
 * Reads the optional server-only `GITHUB_API_BASE_URL` override (used by e2e tests
 * to point at a local mock). Returns `null` unless it is a valid http(s) URL on a
 * loopback host, and always `null` on Vercel production. A user token can therefore
 * never be sent to another machine, even if the variable is set by mistake.
 * (`NODE_ENV` is not used: the e2e run is a production `next start`.)
 */
export function readGitHubApiBaseUrl(env: Record<string, string | undefined>): string | null {
  if (env.VERCEL_ENV === "production") return null;
  const value = env.GITHUB_API_BASE_URL?.trim();
  if (!value) return null;
  const parsed = z.url({ protocol: /^https?$/ }).safeParse(value);
  if (!parsed.success) return null;
  const url = new URL(parsed.data);
  // No embedded credentials: they are never needed for a local mock and make
  // misleading URLs like `http://x@evil.example@127.0.0.1` possible.
  if (url.username !== "" || url.password !== "") return null;
  if (!LOOPBACK_HOSTS.has(url.hostname)) return null;
  return value.replace(/\/+$/, "");
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
