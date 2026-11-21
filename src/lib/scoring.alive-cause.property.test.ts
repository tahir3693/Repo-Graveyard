/**
 * Feature: death-scoring, Property 18: Alive status never has a death cause
 *
 * **Validates: Requirements 6.7, 13.15**
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

type Coverage = {
  statuses: Record<Status, number>;
  aliveStaleIssues: number;
  aliveFailingCi: number;
  aliveOutdatedDeps: number;
};

describe("Feature: death-scoring, Property 18: Alive status never has a death cause", () => {
  it("has exactly six death causes, all in CAUSE_CODES", () => {
    expect(DEATH_CODES).toHaveLength(6);
    for (const code of DEATH_CODES) expect(CAUSE_CODES).toContain(code);
  });

  it("alive repos always carry still_active, never a death cause", () => {
    fc.assert(
      fc.property(arbRepoAndValidNow, ({ repo, now }) => {
        const tomb = scoreRepo(repo, now);
        if (tomb.status !== "alive") return;
        expect(tomb.cause.code).toBe("still_active");
        expect(DEATH_CODES).not.toContain(tomb.cause.code);
        expect(tomb.cause.label).toBe("Still active");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("generators reach every status, and alive cases with stale issues, failing CI and outdated deps", () => {
    const samples = fc.sample(arbRepoAndValidNow, { numRuns: 2000, seed: SEED });
    const cov: Coverage = {
      statuses: { alive: 0, dying: 0, dead: 0, ancient: 0 },
      aliveStaleIssues: 0,
      aliveFailingCi: 0,
      aliveOutdatedDeps: 0,
    };
    for (const { repo, now } of samples) {
      const tomb = scoreRepo(repo, now);
      cov.statuses[tomb.status] += 1;
      if (tomb.status !== "alive") continue;
      if (repo.openIssues > 0 && tomb.daysInactive !== null && tomb.daysInactive >= 90) {
        cov.aliveStaleIssues += 1;
      }
      if (repo.ciStatus === "failing") cov.aliveFailingCi += 1;
      if (repo.outdatedDeps === true) cov.aliveOutdatedDeps += 1;
    }
    expect(cov.statuses.alive).toBeGreaterThan(0);
    expect(cov.statuses.dying).toBeGreaterThan(0);
    expect(cov.statuses.dead).toBeGreaterThan(0);
    expect(cov.statuses.ancient).toBeGreaterThan(0);
    expect(cov.aliveStaleIssues).toBeGreaterThan(0);
    expect(cov.aliveFailingCi).toBeGreaterThan(0);
    expect(cov.aliveOutdatedDeps).toBeGreaterThan(0);
  });

  it("contradiction case (b): 90 days, 3 open issues, passing CI, no outdated deps, README gives 23, alive, still_active", () => {
    const now = new Date("2025-06-01T00:00:00.000Z");
    const repo: RepoHealth = {
      name: "case-b",
      url: "https://github.com/octo/case-b",
      description: null,
      lastCommitAt: "2025-03-03T00:00:00.000Z",
      openIssues: 3,
      archived: false,
      ciStatus: "passing",
      hasReadme: true,
      outdatedDeps: false,
      stars: 0,
      language: null,
    };
    const tomb = scoreRepo(repo, now);
    expect(tomb.daysInactive).toBe(90);
    expect(tomb.score).toBe(23);
    expect(tomb.status).toBe("alive");
    expect(tomb.cause).toEqual({ code: "still_active", label: "Still active" });
  });
});
