/**
 * Safe diagnostics for unexpected exceptions on the scan path (security.md, Secrets).
 * Pure: no I/O. A log entry carries an error name, a step label and one short redacted
 * message. It never carries the error object, a stack, headers, cookies, tokens or a
 * response body.
 */
import type { ZodError } from "zod";

/** The stage that was running. Short labels, so a log line says where an exception happened. */
export type ScanStep = "read-body" | "read-token" | "list-repos" | "fetch-details" | "build-response";

export type LogEntry = {
  code: string;
  requestId: string;
  errorName?: string;
  step?: string;
  message?: string;
};

export type Diagnostics = { errorName: string; step: ScanStep; message: string };

export const MESSAGE_MAX_CHARS = 120;

/** Bounds the work of the redaction patterns on a huge message. */
const INPUT_SCAN_LIMIT = 10_000;

const REDACTED = "[redacted]";

/**
 * Order matters: "Bearer <value>" goes first so the whole header value is replaced, then the
 * known token shapes, then any long run of base64 characters (session cookies, signing keys).
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /Bearer\s+\S+/gi,
  /github_pat_[A-Za-z0-9_]+/g,
  /gh[pousr]_[A-Za-z0-9_]+/g,
  /[A-Za-z0-9+/_-]{32,}={0,2}/g,
];

/** Replaces anything that looks like a token or a long base64 string with `[redacted]`. */
export function redact(text: string): string {
  let result = text;
  if (result.length > INPUT_SCAN_LIMIT) {
    // Drop a trailing partial run too, so a cut-off token cannot slip past the length rule.
    result = result.slice(0, INPUT_SCAN_LIMIT).replace(/[A-Za-z0-9+/_=-]*$/, "");
  }
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }
  return result;
}

/** One line, redacted first and cut second, so a token that straddles the limit is never half shown. */
export function cutMessage(text: string): string {
  const oneLine = redact(text).replace(/\s+/g, " ").trim();
  return Array.from(oneLine).slice(0, MESSAGE_MAX_CHARS).join("");
}

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_$]{0,59}$/;

export function safeErrorName(error: unknown): string {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name: unknown = error.name;
    if (typeof name === "string" && NAME_PATTERN.test(name)) return redact(name);
  }
  return error instanceof Error ? "Error" : "NonError";
}

/** The message of an Error or a thrown string, redacted and cut. Anything else gives "". */
export function safeMessage(error: unknown): string {
  if (typeof error === "string") return cutMessage(error);
  if (typeof error === "object" && error !== null && "message" in error) {
    const message: unknown = error.message;
    if (typeof message === "string") return cutMessage(message);
  }
  return "";
}

export function describeError(error: unknown, step: ScanStep): Diagnostics {
  return { errorName: safeErrorName(error), step, message: safeMessage(error) };
}

/**
 * Where a response failed validation: the first issue's field path and issue code, for example
 * "repos.3.url: invalid_format". Never a value from the data.
 */
export function describeZodIssue(error: ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return "";
  const path = issue.path.map((part) => String(part)).join(".");
  return cutMessage(`${path === "" ? "(root)" : path}: ${issue.code}`);
}

/**
 * The only shape that reaches the log sink: a fixed set of short strings. Anything else on the
 * entry is dropped, and the message is redacted again in case another producer passed raw text.
 */
export function toLogLine(entry: LogEntry): LogEntry {
  const line: LogEntry = { code: entry.code, requestId: entry.requestId };
  if (entry.errorName !== undefined) line.errorName = safeErrorName({ name: entry.errorName });
  if (entry.step !== undefined) line.step = cutMessage(entry.step);
  if (entry.message !== undefined) line.message = cutMessage(entry.message);
  return line;
}
