import { z } from "zod";
import { RESURRECTION_LIMITS } from "./limits";
import { boundedText } from "./plan";

const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

const RepoNameSchema = z
  .string()
  .regex(REPO_NAME_PATTERN)
  .refine((name) => name !== "." && name !== "..");

const noLineBreak = (value: string) => !/[\r\n]/.test(value);

/** Unknown keys (`owner`, `username`, `labels`, ...) are stripped by `z.object`. */
export const ResurrectRequestSchema = z.object({
  repo: RepoNameSchema,
  demo: z.boolean().optional(),
  /** Demo sample repos: the server uses its bundled data for this name. No owner, no content. */
  sample: z.boolean().optional(),
});

export type ResurrectRequest = z.infer<typeof ResurrectRequestSchema>;

export const IssueRequestSchema = z.object({
  repo: RepoNameSchema,
  title: boundedText(1, RESURRECTION_LIMITS.PLAN_TITLE_MAX).refine(noLineBreak),
  body: boundedText(1, RESURRECTION_LIMITS.ISSUE_BODY_MAX_REQUEST),
  demo: z.boolean().optional(),
});

export type IssueRequest = z.infer<typeof IssueRequestSchema>;

/** A missing Origin header is allowed. Any other value must match an allowed origin exactly. */
export function isAllowedOrigin(originHeader: string | null, allowed: readonly string[]): boolean {
  if (originHeader === null) return true;
  return allowed.includes(originHeader);
}

export function isJsonContentType(header: string | null): boolean {
  if (header === null) return false;
  const mediaType = header.split(";")[0] ?? "";
  return mediaType.trim().toLowerCase() === "application/json";
}

export type BodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" | "unreadable" };

/** Counts bytes per chunk and never trusts Content-Length. */
export async function readBodyLimited(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<BodyResult> {
  if (body === null) return { ok: true, text: "" };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}
