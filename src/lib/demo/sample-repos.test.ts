import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RepoHealthSchema } from "@/lib/github/repo-health";
import { scoreRepo } from "@/lib/scoring";
import { getSampleRepos, scoreSampleRepos } from "./sample-repos";

const NOW = new Date("2026-11-22T12:00:00.000Z");

describe("sample repos", () => {
  it("has 8 valid, uniquely named repos", () => {
    const repos = getSampleRepos(NOW);
    expect(repos).toHaveLength(8);
    for (const repo of repos) expect(RepoHealthSchema.safeParse(repo).success).toBe(true);
    expect(new Set(repos.map((r) => r.name)).size).toBe(8);
  });

  it("uses a neutral placeholder host, never a real account", () => {
    for (const repo of getSampleRepos(NOW)) {
      expect(repo.url.startsWith("https://example.com/")).toBe(true);
    }
  });

  it("covers every status through the real scoreRepo", () => {
    const statuses = new Set(scoreSampleRepos(NOW).map((e) => e.tombstone.status));
    expect([...statuses].sort()).toEqual(["alive", "ancient", "dead", "dying"]);
  });

  it("matches scoreRepo exactly and gives every repo a cause and epitaph", () => {
    for (const { repo, tombstone } of scoreSampleRepos(NOW)) {
      expect(tombstone).toEqual(scoreRepo(repo, NOW));
      expect(tombstone.cause.label.length).toBeGreaterThan(0);
      expect(tombstone.epitaph.length).toBeGreaterThan(0);
    }
  });

  it("has failing CI on two, outdated deps on two, one archived and varied data", () => {
    const repos = getSampleRepos(NOW);
    expect(repos.filter((r) => r.ciStatus === "failing")).toHaveLength(2);
    expect(repos.filter((r) => r.outdatedDeps === true)).toHaveLength(2);
    expect(repos.filter((r) => r.archived)).toHaveLength(1);
    expect(new Set(repos.map((r) => r.stars)).size).toBeGreaterThan(5);
    expect(new Set(repos.map((r) => r.lastCommitAt)).size).toBe(8);
  });

  it("the archived repo is the ancient one", () => {
    const archived = scoreSampleRepos(NOW).filter((e) => e.repo.archived);
    expect(archived.map((e) => e.tombstone.status)).toEqual(["ancient"]);
    expect(archived[0]?.tombstone.cause.code).toBe("archived");
  });

  it("gives the same four statuses for any current time", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01T00:00:00Z"), max: new Date("2100-01-01T00:00:00Z"), noInvalidDate: true }),
        (now) => {
          const entries = scoreSampleRepos(now);
          const statuses = new Set(entries.map((e) => e.tombstone.status));
          expect(statuses.size).toBe(4);
          expect(entries.map((e) => e.tombstone.score)).toEqual(
            scoreSampleRepos(now).map((e) => e.tombstone.score),
          );
        },
      ),
    );
  });
});
