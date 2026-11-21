import { Octokit } from "octokit";
import type { GitHubResponse } from "./requester";
import { REQUEST_TIMEOUT_MS } from "./requester";

export const ISSUE_WRITE_ROUTE = "POST /repos/{owner}/{repo}/issues";

const ALLOWED_PARAMS = ["body", "owner", "repo", "title"] as const;

/** The only write the app performs: create one issue. Injected so tests can use a fake. */
export type IssueWriter = (
  route: string,
  params: Record<string, unknown>,
) => Promise<GitHubResponse>;

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

function hasExactlyAllowedParams(params: Record<string, unknown>): boolean {
  const keys = Object.keys(params).sort();
  return (
    keys.length === ALLOWED_PARAMS.length &&
    keys.every((key, index) => key === ALLOWED_PARAMS[index]) &&
    keys.every((key) => typeof params[key] === "string")
  );
}

/**
 * Narrow writer that can send only `POST /repos/{owner}/{repo}/issues` with exactly
 * `owner`, `repo`, `title` and `body`. Anything else throws before Octokit is called.
 */
export function createIssueWriter(token: string, baseUrl: string | null = null): IssueWriter {
  const octokit = new Octokit({
    auth: token,
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
    if (route !== ISSUE_WRITE_ROUTE) {
      throw new Error("Only issue creation is allowed");
    }
    if (!hasExactlyAllowedParams(params)) {
      throw new Error("Unexpected issue parameters");
    }
    const response = await octokit.request(ISSUE_WRITE_ROUTE, {
      owner: String(params.owner),
      repo: String(params.repo),
      title: String(params.title),
      body: String(params.body),
    });
    return {
      status: response.status,
      headers: normalizeHeaders(response.headers),
      data: response.data,
    };
  };
}
