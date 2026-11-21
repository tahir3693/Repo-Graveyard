/**
 * Property tests for `scoreRepo`, in this order:
 * 1. Monotonic  2. Bounded  3. Deterministic and time-shift invariant
 * 4. No throw   5. Status and cause agree  6. Status thresholds
 *
 * Higher death score means more abandoned, so "worse never helps" means a worse
 * repo never gets a LOWER death score.
 *
 * `now` is always passed as an argument. Nothing here reads the system clock.
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { scoreRepo, statusFromScore, TombstoneSchema, type Status } from "@/lib/scoring";
import type { RepoHealth } from "@/lib/github/repo-health";

const NUM_RUNS = 300;
const DAY = 86_400_000;
const MAX_ISSUES = 1_000_000;
const NOW_MIN = Date.UTC(2000, 0, 1);
const NOW_MAX = Date.UTC(2040, 0, 1);

const DEATH_CAUSES: ReadonlyArray<string> = [
  "archived",
  "abandoned_failing_ci",
  "died_with_issues",
  "outdated_and_forgotten",
  "quietly_retired",
  "fading_health",
];

const STATUS_RANK: Record<Status, number> = { alive: 0, dying: 1, dead: 2, ancient: 3 };

/** Independent copy of the status bands: 0-24 alive, 25-59 dying, 60-89 dead, 90-100 ancient. */
function expectedStatus(score: number): Status {
  if (score <= 24) return "alive";
  if (score <= 59) return "dying";
  if (score <= 89) return "dead";
  return "ancient";
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const arbNowMs = fc.integer({ min: NOW_MIN, max: NOW_MAX });

/** Commit time before `now`, in ms. Negative values are future commits. */
const arbOffsetMs = fc.oneof(
  {
    weight: 1,
    arbitrary: fc.constantFrom(
      0, 1, -1, DAY - 1, DAY, 29 * DAY, 30 * DAY, 31 * DAY, 89 * DAY, 90 * DAY,
      364 * DAY, 365 * DAY, 36_500 * DAY, 40_000 * DAY, -DAY, -1000 * DAY,
    ),
  },
  { weight: 3, arbitrary: fc.integer({ min: -1000 * DAY, max: 40_000 * DAY }) },
);

/** Issue counts up to 1,000,000, with the edges and small counts weighted in. */
const arbIssues = fc.oneof(
  fc.constantFrom(0, 1, 2, 3, 4, 5, 999_999, MAX_ISSUES),
  fc.integer({ min: 0, max: 10 }),
  fc.integer({ min: 0, max: MAX_ISSUES }),
);

const arbCiStatus = fc.constantFrom<RepoHealth["ciStatus"]>("passing", "failing", "none");
const arbOutdatedDeps = fc.constantFrom<boolean | null>(true, false, null);
const arbArchived = fc.integer({ min: 0, max: 4 }).map((n) => n === 0);

type Fields = Omit<RepoHealth, "lastCommitAt">;

const arbFields: fc.Arbitrary<Fields> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  url: fc.constant("https://github.com/octo/repo"),
  description: fc.option(fc.string({ maxLength: 50 })),
  openIssues: arbIssues,
  archived: arbArchived,
  ciStatus: arbCiStatus,
  hasReadme: fc.boolean(),
  outdatedDeps: arbOutdatedDeps,
  stars: fc.oneof(fc.constantFrom(0, MAX_ISSUES), fc.nat({ max: MAX_ISSUES })),
  language: fc.option(fc.constantFrom("TypeScript", "Go", "Rust")),
});

/** A schema-valid repo described relative to `now`. `offsetMs: null` means zero commits. */
type Case = { nowMs: number; offsetMs: number | null; fields: Fields };

const arbCase: fc.Arbitrary<Case> = fc.record({
  nowMs: arbNowMs,
  offsetMs: fc.oneof(
    { weight: 1, arbitrary: fc.constant(null) },
    { weight: 5, arbitrary: arbOffsetMs },
  ),
  fields: arbFields,
});

const iso = (ms: number): string => new Date(ms).toISOString();

function toRepo(c: Case): RepoHealth {
  return { ...c.fields, lastCommitAt: c.offsetMs === null ? null : iso(c.nowMs - c.offsetMs) };
}

type Input = { repo: RepoHealth; now: Date };

const toInput = (c: Case): Input => ({ repo: toRepo(c), now: new Date(c.nowMs) });

const ODD_NUMBERS = [NaN, Infinity, -Infinity, -1, -0, 1.5, Number.MAX_SAFE_INTEGER, MAX_ISSUES];
const INVALID_DATES = [
  "",
  "not a date",
  "March 3 2024",
  "2024-01-01",
  "2024-13-45T00:00:00Z",
  "2024-02-30T25:61:00Z",
  "0000-00-00T00:00:00Z",
];

/** Valid `now` most of the time, an invalid Date sometimes. */
const arbMaybeInvalidNow = (nowMs: number): fc.Arbitrary<Date> =>
  fc.oneof(
    { weight: 4, arbitrary: fc.constant(nowMs).map((ms) => new Date(ms)) },
    { weight: 1, arbitrary: fc.constant(0).map(() => new Date(NaN)) },
  );

const arbOddCommit = (nowMs: number): fc.Arbitrary<string | null> =>
  fc.oneof(
    fc.constant(null),
    arbOffsetMs.map((o) => iso(nowMs - o)),
    fc.constantFrom(...INVALID_DATES),
    fc.string({ maxLength: 40 }),
  );

const arbOddCount = fc.oneof(arbIssues, fc.constantFrom(...ODD_NUMBERS));

/** Typed but odd: NaN and infinite counts, invalid dates, blank names, invalid `now`. */
const arbOddInput: fc.Arbitrary<Input> = arbNowMs.chain((nowMs) =>
  fc.record({
    now: arbMaybeInvalidNow(nowMs),
    repo: fc.record({
      name: fc.oneof(fc.string({ maxLength: 200 }), fc.constantFrom("", "   ", "a\nb")),
      url: fc.constant("https://github.com/octo/repo"),
      description: fc.option(fc.string({ maxLength: 50 })),
      lastCommitAt: arbOddCommit(nowMs),
      openIssues: arbOddCount,
      archived: arbArchived,
      ciStatus: arbCiStatus,
      hasReadme: fc.boolean(),
      outdatedDeps: arbOutdatedDeps,
      stars: arbOddCount,
      language: fc.option(fc.string({ maxLength: 20 })),
    }),
  }),
);

/**
 * Untyped junk where any field may be null or undefined, even fields the type says
 * cannot be. The cast is test-only and deliberate: scoring must still not throw.
 */
function looseRepo(fields: Record<string, unknown>): RepoHealth {
  return fields as unknown as RepoHealth;
}

const nullish = <T>(arb: fc.Arbitrary<T>): fc.Arbitrary<T | null | undefined> =>
  fc.oneof(fc.constantFrom(null, undefined), arb);

const arbNullishInput: fc.Arbitrary<Input> = arbNowMs.chain((nowMs) =>
  fc.record({
    now: arbMaybeInvalidNow(nowMs),
    fields: fc.record({
      name: nullish(fc.string({ maxLength: 50 })),
      url: nullish(fc.constant("https://github.com/octo/repo")),
      description: nullish(fc.string({ maxLength: 20 })),
      lastCommitAt: nullish(arbOddCommit(nowMs)),
      openIssues: nullish(arbOddCount),
      archived: nullish(fc.boolean()),
      ciStatus: nullish(arbCiStatus),
      hasReadme: nullish(fc.boolean()),
      outdatedDeps: nullish(arbOutdatedDeps),
      stars: nullish(arbOddCount),
      language: nullish(fc.string({ maxLength: 20 })),
    }),
  }).map(({ now, fields }) => ({ now, repo: looseRepo(fields) })),
);

/** Every kind of input: valid, odd, and null everywhere. */
const arbAnyInput: fc.Arbitrary<Input> = fc.oneof(
  { weight: 3, arbitrary: arbCase.map(toInput) },
  { weight: 2, arbitrary: arbOddInput },
  { weight: 1, arbitrary: arbNullishInput },
);

// Worsening a repo: older commit (or no commit at all), more issues, failing CI, outdated deps.
type Worsening = {
  older: null | { kind: "days"; extraMs: number } | { kind: "noCommit" };
  extraIssues: number | null;
  failCi: boolean;
  outdateDeps: boolean;
};

const arbWorsening: fc.Arbitrary<Worsening> = fc.record({
  older: fc.oneof(
    fc.constant(null),
    fc.integer({ min: 1, max: 40_000 * DAY }).map((extraMs) => ({ kind: "days" as const, extraMs })),
    fc.constant({ kind: "noCommit" as const }),
  ),
  extraIssues: fc.option(fc.integer({ min: 1, max: MAX_ISSUES })),
  failCi: fc.boolean(),
  outdateDeps: fc.boolean(),
});

/** Applies every requested change that is possible. `changed` is false if none applied. */
function worsen(c: Case, w: Worsening): { worse: Case; changed: boolean } {
  let changed = false;
  let offsetMs = c.offsetMs;
  if (w.older !== null && offsetMs !== null) {
    offsetMs = w.older.kind === "days" ? offsetMs + w.older.extraMs : null;
    changed = true;
  }
  const fields = { ...c.fields };
  if (w.extraIssues !== null) {
    fields.openIssues += w.extraIssues;
    changed = true;
  }
  if (w.failCi && fields.ciStatus !== "failing") {
    fields.ciStatus = "failing";
    changed = true;
  }
  if (w.outdateDeps && fields.outdatedDeps !== true) {
    fields.outdatedDeps = true;
    changed = true;
  }
  return { worse: { nowMs: c.nowMs, offsetMs, fields }, changed };
}

const arbShiftMs = fc.oneof(
  fc.constantFrom(0, 1, -1, DAY, -DAY, 365 * DAY, -365 * DAY),
  fc.integer({ min: -50 * 365 * DAY, max: 50 * 365 * DAY }),
);

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("scoreRepo properties", () => {
  it("1. Monotonic: a strictly worse repo never gets a lower death score", () => {
    fc.assert(
      fc.property(arbCase, arbWorsening, (base, w) => {
        const { worse, changed } = worsen(base, w);
        fc.pre(changed);
        const before = scoreRepo(toRepo(base), new Date(base.nowMs)).score;
        const after = scoreRepo(toRepo(worse), new Date(worse.nowMs)).score;
        expect(after).toBeGreaterThanOrEqual(before);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("2. Bounded: the score is always an integer from 0 to 100", () => {
    fc.assert(
      fc.property(arbAnyInput, ({ repo, now }) => {
        const { score } = scoreRepo(repo, now);
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("3a. Deterministic: the same input gives the same output and is not mutated", () => {
    fc.assert(
      fc.property(arbAnyInput, ({ repo, now }) => {
        const repoBefore = structuredClone(repo);
        const nowBefore = now.getTime();
        const first = scoreRepo(repo, now);
        const second = scoreRepo(repo, now);
        expect(second).toEqual(first);
        expect(repo).toEqual(repoBefore);
        expect(Object.is(now.getTime(), nowBefore)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("3b. Time-shift invariant: moving lastCommitAt and now by the same amount changes nothing", () => {
    fc.assert(
      fc.property(arbCase, arbShiftMs, (c, shift) => {
        const shifted: Case = { ...c, nowMs: c.nowMs + shift };
        const original = scoreRepo(toRepo(c), new Date(c.nowMs));
        const moved = scoreRepo(toRepo(shifted), new Date(shifted.nowMs));
        expect(moved).toEqual(original);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("4. No throw: odd, null, future, invalid and huge inputs never throw and still give a valid Tombstone", () => {
    fc.assert(
      fc.property(arbAnyInput, ({ repo, now }) => {
        let result: unknown;
        expect(() => {
          result = scoreRepo(repo, now);
        }).not.toThrow();
        expect(TombstoneSchema.safeParse(result).success).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("4 (examples). Named edge cases do not throw", () => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    const base: RepoHealth = {
      name: "edge",
      url: "https://github.com/octo/edge",
      description: null,
      lastCommitAt: null,
      openIssues: 0,
      archived: false,
      ciStatus: "none",
      hasReadme: true,
      outdatedDeps: null,
      stars: 0,
      language: null,
    };
    const cases: Array<[string, RepoHealth, Date]> = [
      ["zero commits", base, now],
      ["future commit", { ...base, lastCommitAt: "2030-01-01T00:00:00.000Z" }, now],
      ["invalid date string", { ...base, lastCommitAt: "2024-13-45T00:00:00Z" }, now],
      ["invalid now", { ...base, lastCommitAt: "2024-01-01T00:00:00Z" }, new Date(NaN)],
      ["1,000,000 open issues", { ...base, openIssues: MAX_ISSUES }, now],
      ["NaN issues", { ...base, openIssues: NaN }, now],
    ];
    for (const [label, repo, at] of cases) {
      expect(() => scoreRepo(repo, at), label).not.toThrow();
    }
  });

  it("5. Status and cause agree: alive never has a death cause, other statuses never have Still active", () => {
    fc.assert(
      fc.property(arbAnyInput, ({ repo, now }) => {
        const { status, cause } = scoreRepo(repo, now);
        if (status === "alive") {
          expect(DEATH_CAUSES).not.toContain(cause.code);
          expect(cause.code).toBe("still_active");
        } else {
          expect(cause.code).not.toBe("still_active");
          expect(cause.label).not.toBe("Still active");
          expect(DEATH_CAUSES).toContain(cause.code);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  describe("6. Thresholds: status is a pure function of the score", () => {
    it("statusFromScore matches the bands for every score from 0 to 100", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
          expect(statusFromScore(score)).toBe(expectedStatus(score));
        }),
        { numRuns: NUM_RUNS },
      );
    });

    it("boundaries 24/25, 59/60 and 89/90 fall on the right side", () => {
      const table: Array<[number, Status]> = [
        [0, "alive"], [24, "alive"], [25, "dying"], [59, "dying"],
        [60, "dead"], [89, "dead"], [90, "ancient"], [100, "ancient"],
      ];
      for (const [score, status] of table) expect(statusFromScore(score), String(score)).toBe(status);
    });

    it("a higher score never gives a less severe status", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (a, b) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          expect(STATUS_RANK[statusFromScore(lo)]).toBeLessThanOrEqual(STATUS_RANK[statusFromScore(hi)]);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    it("every scored repo's status is determined by its score alone", () => {
      fc.assert(
        fc.property(arbAnyInput, ({ repo, now }) => {
          const { score, status } = scoreRepo(repo, now);
          expect(status).toBe(expectedStatus(score));
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  it("generators reach the required edge cases and every status", () => {
    const samples = fc.sample(arbAnyInput, { numRuns: 3000, seed: 1031 });
    const seen = {
      zeroCommits: 0,
      futureCommit: 0,
      nullOutdatedDeps: 0,
      nullOtherField: 0,
      millionIssues: 0,
      invalidNow: 0,
      invalidDateString: 0,
      statuses: { alive: 0, dying: 0, dead: 0, ancient: 0 } as Record<Status, number>,
    };
    for (const { repo, now } of samples) {
      const nowMs = now.getTime();
      const commit = repo.lastCommitAt;
      if (commit === null || commit === undefined) seen.zeroCommits += 1;
      if (typeof commit === "string") {
        const ms = Date.parse(commit);
        if (Number.isNaN(ms)) seen.invalidDateString += 1;
        else if (!Number.isNaN(nowMs) && ms > nowMs) seen.futureCommit += 1;
      }
      if (repo.outdatedDeps === null) seen.nullOutdatedDeps += 1;
      if (repo.openIssues === null || repo.ciStatus === null) seen.nullOtherField += 1;
      if (repo.openIssues === MAX_ISSUES) seen.millionIssues += 1;
      if (Number.isNaN(nowMs)) seen.invalidNow += 1;
      seen.statuses[scoreRepo(repo, now).status] += 1;
    }
    expect(seen.zeroCommits).toBeGreaterThan(0);
    expect(seen.futureCommit).toBeGreaterThan(0);
    expect(seen.nullOutdatedDeps).toBeGreaterThan(0);
    expect(seen.nullOtherField).toBeGreaterThan(0);
    expect(seen.millionIssues).toBeGreaterThan(0);
    expect(seen.invalidNow).toBeGreaterThan(0);
    expect(seen.invalidDateString).toBeGreaterThan(0);
    for (const status of Object.keys(seen.statuses) as Status[]) {
      expect(seen.statuses[status], status).toBeGreaterThan(0);
    }
  });
});
