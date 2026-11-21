/**
 * Deterministic scoring foundations: constants, types, day math and fact sanitizing.
 * Pure: no I/O, no clock reads, no randomness, no AI. The current time is always `now`.
 */
import { z } from "zod";
import type { RepoHealth } from "@/lib/github/repo-health";
import { CAUSE_CODES, generateEpitaph } from "@/lib/epitaphs";
import type { CauseCode } from "@/lib/epitaphs";

export type { CauseCode };

export const SCORING_CONSTANTS = {
  INACTIVITY_MAX_POINTS: 70,
  INACTIVITY_FLAT_DAYS: 365,
  FAILING_CI_POINTS: 12,
  ISSUE_POINTS_EACH: 2,
  ISSUE_POINTS_CAP: 8,
  OUTDATED_DEPS_POINTS: 6,
  NO_README_POINTS: 4,
  STALE_AFTER_DAYS: 90,
  ARCHIVED_MIN_SCORE: 90,
  CANDLE_WINDOW_DAYS: 30,
  DYING_CAUSE_ISSUES_MIN: 3,
  MAX_DAYS_INACTIVE: 36_500,
  UNKNOWN_DAYS: 365,
  MS_PER_DAY: 86_400_000,
} as const;

/** Checked top to bottom: the first step whose `minDays` is at most the days wins. */
export const FOG_STEPS = [
  { minDays: 300, fog: 1 },
  { minDays: 120, fog: 0.66 },
  { minDays: 30, fog: 0.33 },
  { minDays: 0, fog: 0 },
] as const;

/** Checked top to bottom: the first band whose `min` is at most the score wins. */
export const STATUS_BANDS = [
  { min: 90, status: "ancient" },
  { min: 60, status: "dead" },
  { min: 25, status: "dying" },
  { min: 0, status: "alive" },
] as const;

export type Status = "alive" | "dying" | "dead" | "ancient";

export type Cause = { code: CauseCode; label: string };

export type Scene = {
  fog: 0 | 0.33 | 0.66 | 1;
  candle: boolean;
  cracks: boolean;
  vines: boolean;
};

/** Sanitized view of a repo. Built once per call by `buildFacts`. */
export type Facts = {
  archived: boolean;
  daysInactive: number | null;
  effectiveDays: number;
  ciStatus: RepoHealth["ciStatus"];
  staleIssues: number;
  outdatedDeps: boolean | null;
  hasReadme: boolean;
  stars: number;
};

const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** A non-negative integer is returned as is. Anything else counts as 0. */
export function toCount(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

/**
 * Whole days from `lastCommitAt` to `now`, rounded down and capped.
 * Null for no date, an unparseable or non-ISO date, or an invalid `now`.
 * 0 when the commit date is in the future.
 */
export function computeDaysInactive(lastCommitAt: string | null, now: Date): number | null {
  if (lastCommitAt === null) return null;
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) return null;
  if (typeof lastCommitAt !== "string" || !ISO_8601_PATTERN.test(lastCommitAt)) return null;
  const commitMs = Date.parse(lastCommitAt);
  if (Number.isNaN(commitMs)) return null;
  const diff = nowMs - commitMs;
  if (diff < 0) return 0;
  return Math.min(Math.floor(diff / SCORING_CONSTANTS.MS_PER_DAY), SCORING_CONSTANTS.MAX_DAYS_INACTIVE);
}

/** Days of inactivity, or the unknown-days value when there is no valid date. */
export function effectiveDaysOf(daysInactive: number | null): number {
  return daysInactive ?? SCORING_CONSTANTS.UNKNOWN_DAYS;
}

/** Round-half-up of `MAX * min(days, FLAT) / FLAT` using integer arithmetic only. */
export function inactivityPoints(effectiveDays: number): number {
  const { INACTIVITY_MAX_POINTS: max, INACTIVITY_FLAT_DAYS: flat } = SCORING_CONSTANTS;
  const days = Math.min(effectiveDays, flat);
  return Math.floor((2 * max * days + flat) / (2 * flat));
}

/**
 * The one place that sanitizes inputs. Never reads `language`, `url` or `description`.
 */
export function buildFacts(repo: RepoHealth, now: Date): Facts {
  const daysInactive = computeDaysInactive(repo.lastCommitAt, now);
  const effectiveDays = effectiveDaysOf(daysInactive);
  const staleIssues =
    effectiveDays >= SCORING_CONSTANTS.STALE_AFTER_DAYS ? toCount(repo.openIssues) : 0;
  return {
    archived: repo.archived,
    daysInactive,
    effectiveDays,
    ciStatus: repo.ciStatus,
    staleIssues,
    outdatedDeps: repo.outdatedDeps,
    hasReadme: repo.hasReadme,
    stars: toCount(repo.stars),
  };
}

const MAX_SCORE = 100;

/** Sum of the five point sources, capped at 100, with the archived floor applied. */
export function computeScore(facts: Facts): number {
  const c = SCORING_CONSTANTS;
  const inactivity = inactivityPoints(facts.effectiveDays);
  const ci = facts.ciStatus === "failing" ? c.FAILING_CI_POINTS : 0;
  const issues = Math.min(facts.staleIssues * c.ISSUE_POINTS_EACH, c.ISSUE_POINTS_CAP);
  const deps = facts.outdatedDeps === true ? c.OUTDATED_DEPS_POINTS : 0;
  const readme = facts.hasReadme === false ? c.NO_README_POINTS : 0;
  const base = Math.min(MAX_SCORE, inactivity + ci + issues + deps + readme);
  return facts.archived ? Math.max(base, c.ARCHIVED_MIN_SCORE) : base;
}

/** First band in `STATUS_BANDS` whose `min` is at most the score. */
export function statusFromScore(score: number): Status {
  const band = STATUS_BANDS.find((b) => score >= b.min);
  return band ? band.status : "alive";
}

export type CauseRule = {
  code: CauseCode;
  label: string;
  kind: "death" | "living";
  matches: (facts: Facts) => boolean;
};

/** Six death rules in fixed priority order, then the one living rule. */
export const CAUSE_RULES: ReadonlyArray<CauseRule> = [
  {
    code: "archived",
    kind: "death",
    label: "Archived and laid to rest",
    matches: (f) => f.archived,
  },
  {
    code: "abandoned_failing_ci",
    kind: "death",
    label: "Abandoned with failing CI",
    matches: (f) => f.effectiveDays >= SCORING_CONSTANTS.STALE_AFTER_DAYS && f.ciStatus === "failing",
  },
  {
    code: "died_with_issues",
    kind: "death",
    label: "Died with open issues",
    matches: (f) => f.staleIssues >= SCORING_CONSTANTS.DYING_CAUSE_ISSUES_MIN,
  },
  {
    code: "outdated_and_forgotten",
    kind: "death",
    label: "Outdated and forgotten",
    matches: (f) => f.effectiveDays >= SCORING_CONSTANTS.STALE_AFTER_DAYS && f.outdatedDeps === true,
  },
  {
    code: "quietly_retired",
    kind: "death",
    label: "Quietly retired",
    matches: (f) => f.effectiveDays >= SCORING_CONSTANTS.STALE_AFTER_DAYS,
  },
  { code: "fading_health", kind: "death", label: "Health fading", matches: () => true },
  { code: "still_active", kind: "living", label: "Still active", matches: () => true },
];

/** Status first: alive gets the living cause, every other status gets a death cause. */
export function selectCause(facts: Facts, status: Status): Cause {
  const kind = status === "alive" ? "living" : "death";
  const ofKind = CAUSE_RULES.filter((r) => r.kind === kind);
  const rule = ofKind.find((r) => r.matches(facts)) ?? ofKind[ofKind.length - 1];
  return { code: rule.code, label: rule.label };
}

/** First step in `FOG_STEPS` whose `minDays` is at most the days. */
export function fogForDays(effectiveDays: number): Scene["fog"] {
  const step = FOG_STEPS.find((s) => effectiveDays >= s.minDays);
  return step ? step.fog : 0;
}

export function computeScene(facts: Facts): Scene {
  return {
    fog: fogForDays(facts.effectiveDays),
    candle:
      !facts.archived &&
      facts.daysInactive !== null &&
      facts.daysInactive <= SCORING_CONSTANTS.CANDLE_WINDOW_DAYS,
    cracks: facts.ciStatus === "failing",
    vines: facts.outdatedDeps === true,
  };
}

const NonBlank = z.string().refine((s) => s.trim().length > 0, "must not be blank");

export const TombstoneSchema = z.strictObject({
  score: z.number().int().min(0).max(100),
  status: z.enum(["alive", "dying", "dead", "ancient"]),
  cause: z.strictObject({
    code: z.enum(CAUSE_CODES),
    label: NonBlank.max(80),
  }),
  epitaph: NonBlank.max(80),
  daysInactive: z.number().int().min(0).max(SCORING_CONSTANTS.MAX_DAYS_INACTIVE).nullable(),
  scene: z.strictObject({
    fog: z.number().min(0).max(1),
    candle: z.boolean(),
    cracks: z.boolean(),
    vines: z.boolean(),
  }),
});

export type Tombstone = z.infer<typeof TombstoneSchema>;

/** Pure pipeline: facts, score, status, then cause from the status, scene and epitaph. */
export function scoreRepo(repo: RepoHealth, now: Date): Tombstone {
  const facts = buildFacts(repo, now);
  const score = computeScore(facts);
  const status = statusFromScore(score);
  const cause = selectCause(facts, status);
  const epitaph = generateEpitaph(
    cause.code,
    {
      name: repo.name,
      daysInactive: facts.daysInactive,
      staleIssues: facts.staleIssues,
      stars: facts.stars,
    },
    cause.code === "died_with_issues" ? { requireFact: "issues" } : undefined,
  );
  return {
    score,
    status,
    cause: { code: cause.code, label: cause.label },
    epitaph,
    daysInactive: facts.daysInactive,
    scene: computeScene(facts),
  };
}
