import { z } from "zod";
import { RepoHealthSchema } from "@/lib/github/repo-health";

export const ERROR_CODES = [
  "validation_error",
  "unauthorized",
  "token_revoked",
  "forbidden",
  "account_not_found",
  "rate_limited",
  "invalid_github_response",
  "github_unavailable",
  "auth_not_configured",
  "demo_unavailable",
  "internal_error",
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

type ErrorEntry = { status: number; message: string };

export const ERROR_TABLE: Record<ErrorCode, ErrorEntry> = {
  validation_error: { status: 400, message: "The request was not valid." },
  unauthorized: { status: 401, message: "Sign in to scan your repositories." },
  token_revoked: {
    status: 401,
    message: "Your GitHub session expired. Sign in again.",
  },
  forbidden: { status: 403, message: "GitHub refused this request." },
  account_not_found: {
    status: 404,
    message: "That GitHub account was not found.",
  },
  rate_limited: {
    status: 429,
    message: "GitHub request limits were reached. Try again later.",
  },
  invalid_github_response: {
    status: 502,
    message: "The scan could not be completed.",
  },
  github_unavailable: {
    status: 502,
    message: "GitHub could not be reached. Try again later.",
  },
  auth_not_configured: {
    status: 503,
    message: "Sign-in is not available right now.",
  },
  demo_unavailable: {
    status: 503,
    message: "Demo mode is not available right now.",
  },
  internal_error: { status: 500, message: "Something went wrong. Try again." },
};

export const SafeErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    resetAt: z.iso.datetime().optional(),
  }),
});

export type SafeError = z.infer<typeof SafeErrorSchema>;

export const ScanSuccessSchema = z.object({
  mode: z.enum(["user", "demo"]),
  repos: z.array(RepoHealthSchema),
  skippedForks: z.number().int().nonnegative(),
  skippedInvalid: z.number().int().nonnegative(),
  truncated: z.boolean(),
  code: z.enum(["empty_account", "rate_limited"]).optional(),
  stale: z.boolean().optional(),
  cachedAt: z.iso.datetime().optional(),
  resetAt: z.iso.datetime().optional(),
  /** True only in demo mode, when the bundled sample repos replace GitHub data. */
  sampleData: z.boolean().optional(),
});

export type ScanSuccess = z.infer<typeof ScanSuccessSchema>;

export type SafeErrorOptions = {
  /** Only used when code is `rate_limited`. Ignored if not a valid ISO datetime. */
  resetAt?: string;
};

export function buildSafeError(
  code: ErrorCode,
  options: SafeErrorOptions = {},
): SafeError {
  const { message } = ERROR_TABLE[code];
  const resetAt =
    code === "rate_limited" && options.resetAt !== undefined
      ? z.iso.datetime().safeParse(options.resetAt)
      : null;
  return {
    error: {
      code,
      message,
      ...(resetAt?.success ? { resetAt: resetAt.data } : {}),
    },
  };
}

export function safeErrorResponse(
  code: ErrorCode,
  options: SafeErrorOptions = {},
): Response {
  return Response.json(buildSafeError(code, options), {
    status: ERROR_TABLE[code].status,
  });
}
