import { z } from "zod";

export type ScanFailure =
  | { kind: "rate_limited"; resetAt?: string }
  | { kind: "token_revoked" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "unavailable" }
  | { kind: "invalid_response" };

/**
 * Carries only the classified failure. The message is built from the kind,
 * never from upstream text, so nothing from GitHub can leak through it.
 */
export class ScanFailureError extends Error {
  readonly failure: ScanFailure;

  constructor(failure: ScanFailure) {
    super(`Scan failed: ${failure.kind}`);
    this.failure = failure;
  }
}

const HeaderValueSchema = z.union([z.string(), z.number()]).transform(String);

const ErrorShapeSchema = z.object({
  status: z.number().optional().catch(undefined),
  message: z.string().optional().catch(undefined),
  response: z
    .object({
      headers: z.record(z.string(), HeaderValueSchema.optional().catch(undefined)).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});

type ErrorFacts = {
  status: number | undefined;
  message: string;
  headers: Map<string, string>;
};

function readFacts(error: unknown): ErrorFacts {
  const parsed = ErrorShapeSchema.safeParse(error);
  const headers = new Map<string, string>();
  if (!parsed.success) {
    return { status: undefined, message: "", headers };
  }
  const raw = parsed.data.response?.headers ?? {};
  for (const [name, value] of Object.entries(raw)) {
    if (value !== undefined) headers.set(name.toLowerCase(), value);
  }
  return {
    status: parsed.data.status,
    message: parsed.data.message ?? "",
    headers,
  };
}

function parseSeconds(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function toIso(ms: number): string | undefined {
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function deriveResetAt(headers: Map<string, string>, now: Date): string | undefined {
  const reset = parseSeconds(headers.get("x-ratelimit-reset"));
  if (reset !== undefined) {
    const iso = toIso(reset * 1000);
    if (iso !== undefined) return iso;
  }
  const retryAfter = parseSeconds(headers.get("retry-after"));
  if (retryAfter !== undefined) {
    return toIso(now.getTime() + retryAfter * 1000);
  }
  return undefined;
}

function rateLimited(headers: Map<string, string>, now: Date): ScanFailure {
  const resetAt = deriveResetAt(headers, now);
  return resetAt === undefined ? { kind: "rate_limited" } : { kind: "rate_limited", resetAt };
}

function isForbiddenRateLimit(facts: ErrorFacts): boolean {
  return (
    facts.headers.get("x-ratelimit-remaining") === "0" ||
    facts.headers.has("retry-after") ||
    /rate limit/i.test(facts.message)
  );
}

export function classifyGitHubFailure(error: unknown, now: Date): ScanFailure {
  const facts = readFacts(error);
  const { status } = facts;

  if (status === 429) return rateLimited(facts.headers, now);
  if (status === 403) {
    return isForbiddenRateLimit(facts) ? rateLimited(facts.headers, now) : { kind: "forbidden" };
  }
  if (status === 401) return { kind: "token_revoked" };
  if (status === 404) return { kind: "not_found" };
  return { kind: "unavailable" };
}
