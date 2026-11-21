import { describe, expect, it } from "vitest";
import { scoreRepo } from "@/lib/scoring";
import type { ScannedRepo } from "@/lib/graveyard/client";
import { buildGraveEntries, countAlive } from "@/lib/graveyard/tombstones";

const NOW = new Date("2026-11-20T12:00:00Z");

const repo = (partial: Partial<ScannedRepo> & { name: string }): ScannedRepo => ({
  url: `https://github.com/demo-user/${partial.name}`,
  description: null,
  lastCommitAt: null,
  openIssues: 0,
  archived: false,
  ciStatus: "none",
  hasReadme: true,
  outdatedDeps: false,
  stars: 0,
  language: null,
  ...partial,
});

describe("buildGraveEntries", () => {
  const repos = [
    repo({ name: "fresh-start", lastCommitAt: "2026-11-15T12:00:00Z" }),
    repo({ name: "retired-cli", lastCommitAt: "2024-02-01T12:00:00Z", archived: true }),
  ];

  it("returns one entry per repo, in order, scored by scoreRepo with the given now", () => {
    const entries = buildGraveEntries(repos, NOW);
    expect(entries.map((e) => e.repo.name)).toEqual(["fresh-start", "retired-cli"]);
    for (const entry of entries) expect(entry.tombstone).toEqual(scoreRepo(entry.repo, NOW));
  });

  it("gives an archived repo the ancient status and the archived cause", () => {
    const [, archived] = buildGraveEntries(repos, NOW);
    expect(archived.tombstone.status).toBe("ancient");
    expect(archived.tombstone.cause.code).toBe("archived");
  });

  it("returns an empty list for no repos", () => {
    expect(buildGraveEntries([], NOW)).toEqual([]);
  });
});

describe("countAlive", () => {
  it("counts only alive entries", () => {
    const entries = buildGraveEntries(
      [
        repo({ name: "a", lastCommitAt: "2026-11-15T12:00:00Z" }),
        repo({ name: "b", lastCommitAt: "2026-11-10T12:00:00Z" }),
        repo({ name: "c", archived: true }),
      ],
      NOW,
    );
    expect(countAlive(entries)).toBe(2);
  });
});
