/**
 * Revival plan schema, parser and sanitizer. Client-safe: imports only limits.ts and text.ts.
 * Pure: no I/O, no clock, no randomness.
 */
import { z } from "zod";
import { PLAN_FIELD_LIMITS as F, RESURRECTION_LIMITS } from "./limits";
import { codePointLength, removeBidiOverrides, replaceLoneSurrogates } from "./text";

export const DECISIONS = ["revive", "archive", "merge"] as const;
export type Decision = (typeof DECISIONS)[number];

export const EFFORT_LEVELS = ["low", "medium", "high"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

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

/** Residual markup or links. Sanitizing strips these first, so anything left is rejected. */
const LINK_OR_HTML = /<[A-Za-z/!?]|:\/\/|\bwww\.|\]\(|\b(?:javascript|vbscript|mailto):/i;
const noLinkOrHtml = (value: string) => !LINK_OR_HTML.test(value);

/** Text with a length cap that may span lines (diagnosis, issue body). */
function planText(max: number) {
  return boundedText(1, max).refine(noLinkOrHtml, { message: "no links or HTML" });
}

/** One-line text with a length cap. */
function planLine(max: number) {
  return planText(max).refine(noLineBreak, { message: "one line" });
}

const LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _.:-]*$/;

const VerdictSchema = z.object({
  decision: z.enum(DECISIONS),
  reason: planLine(F.VERDICT_REASON),
});

const RoadmapStepSchema = z.object({
  title: planLine(F.STEP_TITLE),
  action: planLine(RESURRECTION_LIMITS.PLAN_STEP_MAX),
  effort: planLine(F.STEP_EFFORT),
  why: planLine(F.STEP_WHY),
});

const EffortSchema = z.object({
  level: z.enum(EFFORT_LEVELS),
  total: planLine(F.EFFORT_TOTAL),
});

const IssueSchema = z.object({
  title: planLine(RESURRECTION_LIMITS.PLAN_TITLE_MAX),
  body: planText(RESURRECTION_LIMITS.PLAN_BODY_MAX),
  labels: z.array(planLine(F.LABEL).regex(LABEL_PATTERN)).max(F.LABELS_MAX),
});

/** A markdown task-list item: `- [ ] text` (or `*`, or a checked box). */
const TASK_ITEM = /^[ \t]*[-*] \[[ xX]\] \S/gm;

export function countTaskItems(markdown: string): number {
  return (markdown.match(TASK_ITEM) ?? []).length;
}

export const RevivalPlanSchema = z
  .object({
    verdict: VerdictSchema,
    diagnosis: planText(RESURRECTION_LIMITS.PLAN_DIAGNOSIS_MAX),
    roadmap: z.array(RoadmapStepSchema).min(F.ROADMAP_MIN).max(F.ROADMAP_MAX),
    quickWins: z.array(planLine(F.QUICK_WIN)).min(F.QUICK_WINS_MIN).max(F.QUICK_WINS_MAX),
    risks: z.array(planLine(F.RISK)).min(F.RISKS_MIN).max(F.RISKS_MAX),
    effort: EffortSchema,
    issue: IssueSchema,
  })
  .refine((plan) => countTaskItems(plan.issue.body) >= plan.roadmap.length, {
    message: "issue body must hold the roadmap as a task list",
    path: ["issue", "body"],
  });

export type RevivalPlan = z.infer<typeof RevivalPlanSchema>;

/** Every text value of a plan, for checks that scan all of it (for example for secrets). */
export function planStrings(plan: RevivalPlan): string[] {
  return [
    plan.verdict.reason,
    plan.diagnosis,
    ...plan.roadmap.flatMap((step) => [step.title, step.action, step.effort, step.why]),
    ...plan.quickWins,
    ...plan.risks,
    plan.effort.total,
    plan.issue.title,
    plan.issue.body,
    ...plan.issue.labels,
  ];
}

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

const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g;
const URL_WITH_SCHEME = /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/\S*/g;
const WWW_ADDRESS = /\bwww\.\S*/gi;
const ACTIVE_SCHEME = /\b(?:javascript|vbscript|mailto):\S*/gi;

/** Keeps the link text of `[text](url)` and drops bare URLs. The schema rejects what is left. */
export function stripLinks(text: string): string {
  return text
    .replace(MARKDOWN_LINK, "$1")
    .replace(URL_WITH_SCHEME, "")
    .replace(WWW_ADDRESS, "")
    .replace(ACTIVE_SCHEME, "");
}

/** Everything model text goes through before the schema: markup, images, mentions and links. */
export function cleanModelText(text: string): string {
  return stripLinks(sanitizePlanText(text));
}

const FENCE = /^```[A-Za-z0-9_+-]*[ \t]*\r?\n([\s\S]*)\r?\n[ \t]*```$/;
const MAX_CLEAN_DEPTH = 4;

export type ParsePlanResult = { ok: true; plan: RevivalPlan } | { ok: false };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Cleans every string in the plan's JSON. Deeper values are left for the schema to reject. */
function cleanValue(value: unknown, depth: number): unknown {
  if (typeof value === "string") return cleanModelText(value);
  if (depth >= MAX_CLEAN_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => cleanValue(item, depth + 1));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = cleanValue(item, depth + 1);
    return out;
  }
  return value;
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
    const result = RevivalPlanSchema.safeParse(cleanValue(parsed, 0));
    return result.success ? { ok: true, plan: result.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}
