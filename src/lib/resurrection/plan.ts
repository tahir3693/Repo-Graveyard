/**
 * Revival plan schema, parser and sanitizer. Client-safe: imports only limits.ts and text.ts.
 * Pure: no I/O, no clock, no randomness.
 */
import { z } from "zod";
import { RESURRECTION_LIMITS } from "./limits";
import { codePointLength, removeBidiOverrides, replaceLoneSurrogates } from "./text";

export const EFFORTS = ["under 1 hour", "a weekend", "a week or more"] as const;
export type Effort = (typeof EFFORTS)[number];

export const EFFORT_LABELS: Record<Effort, string> = {
  "under 1 hour": "Under 1 hour",
  "a weekend": "A weekend",
  "a week or more": "A week or more",
};

export function boundedText(min: number, max: number) {
  return z.string().refine(
    (value) => {
      const length = codePointLength(value);
      return length >= min && length <= max && value.trim().length > 0;
    },
    { message: "text out of bounds" },
  );
}

const noLineBreak = (value: string) => !/[\r\n]/.test(value);

export const RevivalPlanSchema = z.object({
  diagnosis: boundedText(1, RESURRECTION_LIMITS.PLAN_DIAGNOSIS_MAX),
  smallestNextStep: boundedText(1, RESURRECTION_LIMITS.PLAN_STEP_MAX),
  effort: z.enum(EFFORTS),
  issueTitle: boundedText(1, RESURRECTION_LIMITS.PLAN_TITLE_MAX).refine(noLineBreak),
  issueBody: boundedText(1, RESURRECTION_LIMITS.PLAN_BODY_MAX),
});

export type RevivalPlan = z.infer<typeof RevivalPlanSchema>;

const CONTROL_EXCEPT_NEWLINE = /[^\P{Cc}\n]/gu;
const HTML_TAG = /<[^>]*>/g;
const IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const MENTION = /@([A-Za-z0-9][A-Za-z0-9-]{0,38})/g;

function wrapMentions(text: string): string {
  // Splitting on backticks: even-index parts are outside code spans.
  // An odd number of backticks leaves one unpaired backtick. It is dropped so the
  // tail counts as outside code and the result stays stable on a second pass.
  let source = text;
  const count = (source.match(/`/g) ?? []).length;
  if (count % 2 === 1) {
    const last = source.lastIndexOf("`");
    source = source.slice(0, last) + source.slice(last + 1);
  }
  return source
    .split("`")
    .map((part, index) => (index % 2 === 0 ? part.replace(MENTION, "`@$1`") : part))
    .join("`");
}

export function sanitizePlanText(text: string): string {
  try {
    const step1 = removeBidiOverrides(
      replaceLoneSurrogates(text).replace(/\r\n?/g, "\n").replace(CONTROL_EXCEPT_NEWLINE, ""),
    );
    const step2 = step1.replace(HTML_TAG, "");
    const step3 = step2.replace(IMAGE, "$1").replace(/!+\[/g, "[");
    // Dropping an unpaired backtick can join "!" and "[" (for example "!`["), so the
    // image-marker cleanup runs again after wrapping.
    return wrapMentions(step3).replace(/!+\[/g, "[");
  } catch {
    return "";
  }
}

const FENCE = /^```[A-Za-z0-9_+-]*[ \t]*\r?\n([\s\S]*)\r?\n[ \t]*```$/;
const TEXT_FIELDS = ["diagnosis", "smallestNextStep", "issueTitle", "issueBody"] as const;

export type ParsePlanResult = { ok: true; plan: RevivalPlan } | { ok: false };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePlan(rawText: unknown): ParsePlanResult {
  try {
    if (typeof rawText !== "string" || rawText.length > RESURRECTION_LIMITS.LLM_RAW_MAX_CHARS) {
      return { ok: false };
    }
    let text = rawText.trim().replace(/^\uFEFF/, "").trim();
    const fenced = FENCE.exec(text);
    if (fenced) text = fenced[1];
    const parsed: unknown = JSON.parse(text);
    if (!isPlainObject(parsed)) return { ok: false };
    const candidate: Record<string, unknown> = { ...parsed };
    for (const field of TEXT_FIELDS) {
      const value = candidate[field];
      if (typeof value === "string") candidate[field] = sanitizePlanText(value);
    }
    const result = RevivalPlanSchema.safeParse(candidate);
    return result.success ? { ok: true, plan: result.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}
