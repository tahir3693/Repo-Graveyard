/**
 * Feature: death-scoring, Property 19: Non-alive status never has still_active
 *
 * **Validates: Requirements 6.8, 13.16**
 *
 * `now` is always passed as an argument. Nothing here reads the system clock.
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { CAUSE_RULES, scoreRepo, type Status } from "@/lib/scoring";
import { CAUSE_CODES } from "@/lib/epitaphs";
import type { RepoHealth } from "@/lib/github/repo-health";
import { arbRepoAndValidNow } from "@/lib/test-utils/scoring-arbitraries";

const NUM_RUNS = 500;
const SEED = 20240518;

const DEATH_CODES: ReadonlyArray<string> = CAUSE_RULES.filter((r) => r.kind === "death").map(
  (r) => r.code,
);

describe("Feature: death-scoring, Property 19: Non-alive status never has still_active", () => {
  it("has exactly six death causes, all in CAUSE_CODES", () => {
    expect(DEATH_CODES).toHaveLength(6);
    for (const code of DEATH_CODES) expect(CAUSE_CODES).toContain(code);
  });

  it("dying, dead and ancient repos always carry one of the six death causes, never still_active", () => {
    fc.assert(
      fc.property(arbRepoAndValidNow, ({ repo, now }) => {
        const tomb = scoreRepo(repo, now);
        if (tomb.status === "alive") return;
        expect(tomb.cause.code).not.toBe("still_active");
        expect(DEATH_CODES).toContain(tomb.cause.code);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("generators reach every status, and dying cases under 90 days that get fading_health", () => {
    const samples = fc.sample(arbRepoAndValidNow, { numRuns: 2000, seed: SEED });
    const statuses: Record<Status, number> = { alive: 0, dying: 0, dead: 0, ancient: 0 };
    let dyingUnder90FadingHealth = 0;
    for (const { repo, now } of samples) {
      const tomb = scoreRepo(repo, now);
      statuses[tomb.status] += 1;
      if (
        tomb.status === "dying" &&
        tomb.daysInactive !== null &&
        tomb.daysInactive < 90 &&
        tomb.cause.code === "fading_health"
      ) {
        dyingUnder90FadingHealth += 1;
      }
    }
    expect(statuses.alive).toBeGreaterThan(0);
    expect(statuses.dying).toBeGreaterThan(0);
    expect(statuses.dead).toBeGreaterThan(0);
    expect(statuses.ancient).toBeGreaterThan(0);
    expect(dyingUnder90FadingHealth).toBeGreaterThan(0);
  });

  it("contradiction case (a): 29 days, failing CI, outdated deps, no README gives 28, dying, fading_health", () => {
    const now = new Date("2025-06-01T00:00:00.000Z");
    const repo: RepoHealth = {
      name: "case-a",
      url: "https://github.com/octo/case-a",
      description: null,
      lastCommitAt: "2025-05-03T00:00:00.000Z",
      openIssues: 0,
      archived: false,
      ciStatus: "failing",
      hasReadme: false,
      outdatedDeps: true,
      stars: 0,
      language: null,
    };
    const tomb = scoreRepo(repo, now);
    expect(tomb.daysInactive).toBe(29);
    expect(tomb.score).toBe(28);
    expect(tomb.status).toBe("dying");
    expect(tomb.cause).toEqual({ code: "fading_health", label: "Health fading" });
  });
});
