/**
 * Shared fast-check arbitraries and independent reference models for the scoring tests.
 *
 * Test utility only. Not a test file (no `.test.` in the name), so Vitest does not run it.
 * Nothing here reads the system clock: every date is built from integers.
 *
 * The reference helpers do not import any scoring function. The numbers they need are
 * DUPLICATED in `REF` (not imported from SCORING_CONSTANTS), so a wrong constant in
 * production code cannot also be wrong here.
 */
import * as fc from "fast-check";
import type { RepoHealth } from "@/lib/github/repo-health";
import type { CauseCode } from "@/lib/epitaphs";

type Status = "alive" | "dying" | "dead" | "ancient";

const MS_PER_DAY = 86_400_000;
const MIN_NOW_MS = Date.UTC(2000, 0, 1);
const MAX_NOW_MS = Date.UTC(2100, 0, 1);
/** Base used for building commit strings when `now` is invalid. */
const FALLBACK_BASE_MS = Date.UTC(2025, 0, 1);

// ---------------------------------------------------------------------------
// now
// ---------------------------------------------------------------------------

/** Valid dates only, built from integers. */
export const arbValidNow: fc.Arbitrary<Date> = fc
  .integer({ min: MIN_NOW_MS, max: MAX_NOW_MS })
  .map((ms) => new Date(ms));

/** Mostly valid dates, plus `new Date(NaN)` at low weight. */
export const arbNow: fc.Arbitrary<Date> = fc.oneof(
  { weight: 24, arbitrary: arbValidNow },
  { weight: 1, arbitrary: fc.constant(new Date(Number.NaN)) },
);

// ---------------------------------------------------------------------------
// lastCommitAt
// ---------------------------------------------------------------------------

type ArbDays = fc.Arbitrary<number | null>;

/** Days before `now`. Null means no commit date. Negative means a future commit. */
const arbDaysAgoGeneral: ArbDays = fc.oneof(
  { weight: 2, arbitrary: fc.integer({ min: 0, max: 29 }) },
  { weight: 2, arbitrary: fc.integer({ min: 30, max: 89 }) },
  { weight: 3, arbitrary: fc.integer({ min: 90, max: 364 }) },
  { weight: 2, arbitrary: fc.integer({ min: 365, max: 3000 }) },
  { weight: 1, arbitrary: fc.integer({ min: 36_000, max: 40_000 }) },
  { weight: 1, arbitrary: fc.integer({ min: -400, max: -1 }) },
  { weight: 2, arbitrary: fc.constant(null) },
);

const arbExtraMs = fc.oneof(
  { weight: 2, arbitrary: fc.constant(0) },
  { weight: 1, arbitrary: fc.constant(MS_PER_DAY - 1) },
  { weight: 3, arbitrary: fc.integer({ min: 0, max: MS_PER_DAY - 1 }) },
);

const arbOffsetHours = fc.oneof(
  { weight: 5, arbitrary: fc.constant(0) },
  { weight: 1, arbitrary: fc.integer({ min: -12, max: 14 }) },
);

type CommitShape = { daysAgo: number | null; extraMs: number; offsetHours: number };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Builds an ISO 8601 string with `Z` or a numeric offset, `daysAgo` days (+ extra ms) before `baseMs`. */
function toIsoString(baseMs: number, shape: CommitShape): string | null {
  if (shape.daysAgo === null) return null;
  const instant = baseMs - shape.daysAgo * MS_PER_DAY - shape.extraMs;
  if (shape.offsetHours === 0) return new Date(instant).toISOString();
  const local = new Date(instant + shape.offsetHours * 3_600_000).toISOString().slice(0, 23);
  const sign = shape.offsetHours < 0 ? "-" : "+";
  return `${local}${sign}${pad2(Math.abs(shape.offsetHours))}:00`;
}

function baseMsOf(now: Date): number {
  const ms = now.getTime();
  return Number.isNaN(ms) ? FALLBACK_BASE_MS : ms;
}

function arbCommitShape(days: ArbDays): fc.Arbitrary<CommitShape> {
  return fc.record({ daysAgo: days, extraMs: arbExtraMs, offsetHours: arbOffsetHours });
}

const arbNonIsoText: fc.Arbitrary<string> = fc.oneof(
  { weight: 2, arbitrary: fc.constant("") },
  { weight: 1, arbitrary: fc.constant("March 3 2024") },
  { weight: 1, arbitrary: fc.constant("2024-03-03") },
  { weight: 1, arbitrary: fc.constant("2024-13-45T99:99:99Z") },
  { weight: 3, arbitrary: fc.string({ maxLength: 40 }) },
);

/**
 * `lastCommitAt` values relative to `now`: ISO strings before and after it, null,
 * and (unless `schemaValid` is true) the empty string and arbitrary non-ISO text.
 */
export function arbLastCommitAt(
  now: Date,
  options: { schemaValid?: boolean } = {},
): fc.Arbitrary<string | null> {
  const base = baseMsOf(now);
  const iso = arbCommitShape(arbDaysAgoGeneral).map((shape) => toIsoString(base, shape));
  if (options.schemaValid === true) return iso;
  return fc.oneof({ weight: 8, arbitrary: iso }, { weight: 2, arbitrary: arbNonIsoText });
}

// ---------------------------------------------------------------------------
// RepoHealth
// ---------------------------------------------------------------------------

type Profile = {
  daysAgo: ArbDays;
  openIssues: fc.Arbitrary<number>;
  ciStatus: fc.Arbitrary<RepoHealth["ciStatus"]>;
  outdatedDeps: fc.Arbitrary<boolean | null>;
  hasReadme: fc.Arbitrary<boolean>;
  archived: fc.Arbitrary<boolean>;
};

const arbAnyCi = fc.constantFrom<RepoHealth["ciStatus"]>("passing", "failing", "none");
const arbNotFailingCi = fc.constantFrom<RepoHealth["ciStatus"]>("passing", "none");
const arbAnyDeps = fc.constantFrom<boolean | null>(true, false, null);
const arbNoDeps = fc.constantFrom<boolean | null>(false, null);
const arbAnyBool = fc.boolean();
const arbNotArchived = fc.constant(false);
const arbSmallIssues = fc.integer({ min: 0, max: 10 });

const arbIssuesGeneral = fc.oneof(
  { weight: 4, arbitrary: arbSmallIssues },
  { weight: 1, arbitrary: fc.integer({ min: 11, max: 500 }) },
);

/** Mixed profile. Archived repos are rare here (they have their own profile). */
const GENERAL: Profile = {
  daysAgo: arbDaysAgoGeneral,
  openIssues: arbIssuesGeneral,
  ciStatus: arbAnyCi,
  outdatedDeps: arbAnyDeps,
  hasReadme: arbAnyBool,
  archived: fc.oneof(
    { weight: 9, arbitrary: arbNotArchived },
    { weight: 1, arbitrary: fc.constant(true) },
  ),
};

const arbDays = (min: number, max: number): ArbDays => fc.integer({ min, max });

/** Targeted profiles. Comments give the cause or status each one is built to reach. */
const PROFILES: ReadonlyArray<{ weight: number; profile: Profile }> = [
  { weight: 4, profile: GENERAL },
  {
    // alive (score 23 or 24) with stale issues: 90..95 days is 17..18 points, plus at most 6 for issues
    weight: 2,
    profile: {
      daysAgo: arbDays(90, 95),
      openIssues: fc.integer({ min: 1, max: 3 }),
      ciStatus: arbNotFailingCi,
      outdatedDeps: arbNoDeps,
      hasReadme: fc.constant(true),
      archived: arbNotArchived,
    },
  },
  {
    // alive with failing CI and outdated deps: at most 4 + 12 + 6 = 22 points
    weight: 2,
    profile: {
      daysAgo: arbDays(0, 20),
      openIssues: arbIssuesGeneral,
      ciStatus: fc.constant("failing"),
      outdatedDeps: fc.constantFrom<boolean | null>(true, false),
      hasReadme: fc.constant(true),
      archived: arbNotArchived,
    },
  },
  {
    // alive and clean-ish, recent activity
    weight: 2,
    profile: {
      daysAgo: arbDays(0, 30),
      openIssues: arbIssuesGeneral,
      ciStatus: arbNotFailingCi,
      outdatedDeps: arbNoDeps,
      hasReadme: arbAnyBool,
      archived: arbNotArchived,
    },
  },
  {
    // dying under 90 days of inactivity, cause fading_health: 5 + 12 + 6 + 4 = 27 points at 25 days
    weight: 3,
    profile: {
      daysAgo: arbDays(25, 89),
      openIssues: arbIssuesGeneral,
      ciStatus: fc.constant("failing"),
      outdatedDeps: fc.constant(true),
      hasReadme: fc.constant(false),
      archived: arbNotArchived,
    },
  },
  {
    // died_with_issues: 3 or more stale issues, CI not failing, not alive from 120 days up
    weight: 2,
    profile: {
      daysAgo: arbDays(120, 1000),
      openIssues: fc.integer({ min: 3, max: 30 }),
      ciStatus: arbNotFailingCi,
      outdatedDeps: arbAnyDeps,
      hasReadme: arbAnyBool,
      archived: arbNotArchived,
    },
  },
  {
    // outdated_and_forgotten
    weight: 2,
    profile: {
      daysAgo: arbDays(100, 1000),
      openIssues: fc.integer({ min: 0, max: 2 }),
      ciStatus: arbNotFailingCi,
      outdatedDeps: fc.constant(true),
      hasReadme: arbAnyBool,
      archived: arbNotArchived,
    },
  },
  {
    // quietly_retired: 200+ days is at least 38 points, so never alive
    weight: 2,
    profile: {
      daysAgo: arbDays(200, 1000),
      openIssues: fc.integer({ min: 0, max: 2 }),
      ciStatus: arbNotFailingCi,
      outdatedDeps: arbNoDeps,
      hasReadme: arbAnyBool,
      archived: arbNotArchived,
    },
  },
  {
    // abandoned_failing_ci
    weight: 2,
    profile: {
      daysAgo: arbDays(90, 1000),
      openIssues: arbIssuesGeneral,
      ciStatus: fc.constant("failing"),
      outdatedDeps: arbAnyDeps,
      hasReadme: arbAnyBool,
      archived: arbNotArchived,
    },
  },
  {
    // ancient without archiving: 70 + 12 + 8 = 90 points
    weight: 2,
    profile: {
      daysAgo: arbDays(365, 3000),
      openIssues: fc.integer({ min: 4, max: 50 }),
      ciStatus: fc.constant("failing"),
      outdatedDeps: arbAnyDeps,
      hasReadme: arbAnyBool,
      archived: arbNotArchived,
    },
  },
  {
    // archived: always ancient, cause archived
    weight: 2,
    profile: { ...GENERAL, archived: fc.constant(true) },
  },
  {
    // no commit date: effective days 365, 70 inactivity points, so dead or ancient
    weight: 1,
    profile: { ...GENERAL, daysAgo: fc.constant(null) },
  },
];

const arbName = fc.oneof(
  { weight: 6, arbitrary: fc.string({ minLength: 1, maxLength: 40 }) },
  { weight: 1, arbitrary: fc.string({ minLength: 1, maxLength: 200 }) },
  { weight: 1, arbitrary: fc.constantFrom(" ", "\n\t", "{name} {days}") },
);

const arbUrl = fc
  .tuple(fc.stringMatching(/^[a-z0-9]{1,12}$/), fc.stringMatching(/^[a-z0-9]{1,12}$/))
  .map(([owner, repo]) => `https://github.com/${owner}/${repo}`);

const arbDescription = fc.option(fc.string({ maxLength: 60 }), { nil: null });
const arbLanguage = fc.option(fc.constantFrom("TypeScript", "Python", "Rust", "Go"), { nil: null });
const arbStars = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 100 }) },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: 1_000_000_000 }) },
);

function arbRepoFromProfile(now: Date, profile: Profile, schemaValid: boolean): fc.Arbitrary<RepoHealth> {
  const base = baseMsOf(now);
  const lastCommitAt = schemaValid
    ? arbCommitShape(profile.daysAgo).map((shape) => toIsoString(base, shape))
    : fc.oneof(
        { weight: 8, arbitrary: arbCommitShape(profile.daysAgo).map((s) => toIsoString(base, s)) },
        { weight: 2, arbitrary: arbNonIsoText },
      );
  return fc.record({
    name: arbName,
    url: arbUrl,
    description: arbDescription,
    lastCommitAt,
    openIssues: profile.openIssues,
    archived: profile.archived,
    ciStatus: profile.ciStatus,
    hasReadme: profile.hasReadme,
    outdatedDeps: profile.outdatedDeps,
    stars: arbStars,
    language: arbLanguage,
  });
}

/**
 * Schema-valid `RepoHealth` (passes `RepoHealthSchema`) relative to `now`.
 * Weighted so every status and every cause is reached.
 */
export function arbRepoHealthAt(now: Date): fc.Arbitrary<RepoHealth> {
  return fc.oneof(
    ...PROFILES.map(({ weight, profile }) => ({
      weight,
      arbitrary: arbRepoFromProfile(now, profile, true),
    })),
  );
}

const arbOddNumber: fc.Arbitrary<number> = fc.oneof(
  { weight: 1, arbitrary: fc.constant(Number.NaN) },
  { weight: 1, arbitrary: fc.constantFrom(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY) },
  { weight: 2, arbitrary: fc.integer({ min: -1000, max: -1 }) },
  { weight: 2, arbitrary: fc.double({ min: 0, max: 1000, noNaN: true }) },
  { weight: 1, arbitrary: fc.constant(-0) },
  { weight: 2, arbitrary: fc.integer({ min: 0, max: 20 }) },
);

/**
 * "Odd" `RepoHealth`: the TypeScript shape holds, but `openIssues` and `stars` may be
 * NaN, infinite, negative or fractional, and `lastCommitAt` may be non-ISO text.
 * These values would fail `RepoHealthSchema`.
 */
export function arbOddRepoHealthAt(now: Date): fc.Arbitrary<RepoHealth> {
  return fc
    .tuple(
      fc.oneof(...PROFILES.map(({ weight, profile }) => ({ weight, arbitrary: arbRepoFromProfile(now, profile, false) }))),
      arbOddNumber,
      arbOddNumber,
      fc.boolean(),
      fc.boolean(),
    )
    .map(([repo, issues, stars, oddIssues, oddStars]) => ({
      ...repo,
      openIssues: oddIssues ? issues : repo.openIssues,
      stars: oddStars ? stars : repo.stars,
    }));
}

export type RepoAndNow = { repo: RepoHealth; now: Date };

/** `{ repo, now }` with a schema-valid repo and any `now` (invalid dates included at low weight). */
export const arbRepoAndNow: fc.Arbitrary<RepoAndNow> = arbNow.chain((now) =>
  arbRepoHealthAt(now).map((repo) => ({ repo, now })),
);

/** Same as `arbRepoAndNow`, with a valid `now` only. */
export const arbRepoAndValidNow: fc.Arbitrary<RepoAndNow> = arbValidNow.chain((now) =>
  arbRepoHealthAt(now).map((repo) => ({ repo, now })),
);

/** `{ repo, now }` with an odd repo and any `now`. */
export const arbOddRepoAndNow: fc.Arbitrary<RepoAndNow> = arbNow.chain((now) =>
  arbOddRepoHealthAt(now).map((repo) => ({ repo, now })),
);

// ---------------------------------------------------------------------------
// Independent reference models (no production imports besides types)
// ---------------------------------------------------------------------------

const REF = {
  inactivityMax: 70,
  flatDays: 365,
  failingCi: 12,
  issueEach: 2,
  issueCap: 8,
  outdatedDeps: 6,
  noReadme: 4,
  staleAfter: 90,
  archivedMin: 90,
  causeIssuesMin: 3,
  maxDays: 36_500,
  unknownDays: 365,
} as const;

const REF_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** Whole days of inactivity, or null when there is no usable date. */
export function referenceDaysInactive(lastCommitAt: string | null, now: Date): number | null {
  if (lastCommitAt === null) return null;
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) return null;
  if (!REF_ISO.test(lastCommitAt)) return null;
  const commitMs = Date.parse(lastCommitAt);
  if (Number.isNaN(commitMs)) return null;
  if (commitMs > nowMs) return 0;
  return Math.min(Math.floor((nowMs - commitMs) / MS_PER_DAY), REF.maxDays);
}

/** Property 3 model: floating-point `Math.round`. Valid repos only (counts are non-negative integers). */
export function referenceScore(repo: RepoHealth, now: Date): number {
  const days = referenceDaysInactive(repo.lastCommitAt, now);
  const effective = days === null ? REF.unknownDays : days;
  const inactivity = Math.round((REF.inactivityMax * Math.min(effective, REF.flatDays)) / REF.flatDays);
  const stale = effective >= REF.staleAfter ? repo.openIssues : 0;
  const total =
    inactivity +
    (repo.ciStatus === "failing" ? REF.failingCi : 0) +
    Math.min(stale * REF.issueEach, REF.issueCap) +
    (repo.outdatedDeps === true ? REF.outdatedDeps : 0) +
    (repo.hasReadme ? 0 : REF.noReadme);
  const capped = Math.min(100, total);
  return repo.archived ? Math.max(capped, REF.archivedMin) : capped;
}

/** Status band of a score, as a plain if-chain. */
export function referenceStatus(score: number): Status {
  if (score >= 90) return "ancient";
  if (score >= 60) return "dead";
  if (score >= 25) return "dying";
  return "alive";
}

/**
 * Property 8 model: status first, then the death rules in priority order, as a plain if-chain.
 * Valid repos only.
 */
export function referenceCauseCode(repo: RepoHealth, now: Date): CauseCode {
  const status = referenceStatus(referenceScore(repo, now));
  if (status === "alive") return "still_active";

  const days = referenceDaysInactive(repo.lastCommitAt, now);
  const effective = days === null ? REF.unknownDays : days;
  const stale = effective >= REF.staleAfter ? repo.openIssues : 0;
  const isStale = effective >= REF.staleAfter;

  if (repo.archived) return "archived";
  if (isStale && repo.ciStatus === "failing") return "abandoned_failing_ci";
  if (stale >= REF.causeIssuesMin) return "died_with_issues";
  if (isStale && repo.outdatedDeps === true) return "outdated_and_forgotten";
  if (isStale) return "quietly_retired";
  return "fading_health";
}
