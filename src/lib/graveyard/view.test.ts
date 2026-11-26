import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getSampleRepos } from "@/lib/demo/sample-repos";
import { buildGraveEntries, type GraveEntry } from "@/lib/graveyard/tombstones";
import {
  FILTERS,
  STATUS_ORDER,
  countByStatus,
  filterEntries,
  isFilter,
  isSortKey,
  resultsText,
  skippedText,
  sortEntries,
  summaryText,
} from "@/lib/graveyard/view";

const NOW = new Date("2026-11-22T12:00:00.000Z");
const entries = buildGraveEntries(getSampleRepos(NOW), NOW);

const names = (list: readonly GraveEntry[]) => list.map((e) => e.repo.name);

describe("countByStatus", () => {
  it("counts the sample repos by real status (2 alive, 2 dying, 3 dead, 1 ancient)", () => {
    expect(countByStatus(entries)).toEqual({ alive: 2, dying: 2, dead: 3, ancient: 1, total: 8 });
  });

  it("returns all zeros for no entries", () => {
    expect(countByStatus([])).toEqual({ alive: 0, dying: 0, dead: 0, ancient: 0, total: 0 });
  });

  it("status counts always add up to the total", () => {
    fc.assert(
      fc.property(fc.subarray(entries), (subset) => {
        const c = countByStatus(subset);
        expect(c.alive + c.dying + c.dead + c.ancient).toBe(c.total);
        expect(c.total).toBe(subset.length);
      }),
    );
  });
});

describe("summaryText", () => {
  it("lists every status in the fixed order", () => {
    expect(summaryText(countByStatus(entries))).toBe("8 repos: 2 alive, 2 dying, 3 dead, 1 ancient");
  });

  it("matches the documented example shape", () => {
    expect(summaryText({ alive: 3, dying: 4, dead: 3, ancient: 2, total: 12 })).toBe(
      "12 repos: 3 alive, 4 dying, 3 dead, 2 ancient",
    );
  });

  it("uses the singular for one repo and keeps zero counts", () => {
    expect(summaryText({ alive: 0, dying: 0, dead: 1, ancient: 0, total: 1 })).toBe(
      "1 repo: 0 alive, 0 dying, 1 dead, 0 ancient",
    );
  });

  it("says there are no repos when the list is empty", () => {
    expect(summaryText(countByStatus([]))).toBe("No repos yet");
  });
});

describe("filterEntries", () => {
  it("All keeps every entry, in order, as a copy", () => {
    const all = filterEntries(entries, "all");
    expect(names(all)).toEqual(names(entries));
    expect(all).not.toBe(entries);
  });

  it.each(STATUS_ORDER)("%s keeps only entries with that status", (status) => {
    const result = filterEntries(entries, status);
    expect(result.length).toBe(countByStatus(entries)[status]);
    expect(result.every((e) => e.tombstone.status === status)).toBe(true);
  });

  it("returns nothing when no entry matches", () => {
    const aliveOnly = filterEntries(entries, "alive");
    expect(filterEntries(aliveOnly, "ancient")).toEqual([]);
  });

  it("the four status filters split the list with no overlap and no loss", () => {
    const parts = STATUS_ORDER.flatMap((status) => names(filterEntries(entries, status)));
    expect([...parts].sort()).toEqual([...names(entries)].sort());
  });

  it("filtering twice gives the same result as once", () => {
    fc.assert(
      fc.property(fc.constantFrom(...FILTERS), (filter) => {
        const once = filterEntries(entries, filter);
        expect(names(filterEntries(once, filter))).toEqual(names(once));
      }),
    );
  });
});

describe("sortEntries", () => {
  it("newest activity puts the most recent commit first", () => {
    const times = sortEntries(entries, "newest").map((e) => Date.parse(e.repo.lastCommitAt ?? ""));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(sortEntries(entries, "newest")[0]?.repo.name).toBe("moonlit-notes");
  });

  it("oldest activity is the exact reverse order of newest for distinct dates", () => {
    expect(names(sortEntries(entries, "oldest"))).toEqual(names(sortEntries(entries, "newest")).reverse());
    expect(sortEntries(entries, "oldest")[0]?.repo.name).toBe("old-lighthouse");
  });

  it("most stars sorts by stars, highest first", () => {
    const stars = sortEntries(entries, "stars").map((e) => e.repo.stars);
    expect(stars).toEqual([...stars].sort((a, b) => b - a));
    expect(sortEntries(entries, "stars")[0]?.repo.name).toBe("old-lighthouse");
  });

  it("treats a repo with no commits as the oldest activity", () => {
    const base = entries[0];
    if (base === undefined) throw new Error("sample repos missing");
    const none: GraveEntry = { ...base, repo: { ...base.repo, name: "never-committed", lastCommitAt: null } };
    const list = [...entries, none];
    expect(sortEntries(list, "newest").at(-1)?.repo.name).toBe("never-committed");
    expect(sortEntries(list, "oldest")[0]?.repo.name).toBe("never-committed");
  });

  it("breaks ties by name, and does not change the input", () => {
    const base = entries[0];
    if (base === undefined) throw new Error("sample repos missing");
    const mk = (name: string): GraveEntry => ({ ...base, repo: { ...base.repo, name, stars: 5 } });
    const tied = [mk("b"), mk("c"), mk("a")];
    expect(names(sortEntries(tied, "stars"))).toEqual(["a", "b", "c"]);
    expect(names(tied)).toEqual(["b", "c", "a"]);
  });

  it("every sort keeps the same entries (a permutation)", () => {
    fc.assert(
      fc.property(fc.constantFrom("newest", "oldest", "stars" as const), fc.subarray(entries), (key, subset) => {
        expect([...names(sortEntries(subset, key))].sort()).toEqual([...names(subset)].sort());
      }),
    );
  });
});

describe("guards and labels", () => {
  it("accepts only known filters and sort keys", () => {
    expect(isFilter("alive")).toBe(true);
    expect(isFilter("zombie")).toBe(false);
    expect(isSortKey("stars")).toBe(true);
    expect(isSortKey("random")).toBe(false);
  });

  it("builds the results line", () => {
    expect(resultsText(4, 12)).toBe("Showing 4 of 12 repos");
    expect(resultsText(1, 1)).toBe("Showing 1 of 1 repo");
  });
});

describe("skippedText", () => {
  it("says nothing when no repo was skipped, or the count is not a positive whole number", () => {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(skippedText(value)).toBeNull();
    }
  });

  it("uses the singular for one repo and the plural for more", () => {
    expect(skippedText(1)).toBe("1 repo could not be read");
    expect(skippedText(2)).toBe("2 repos could not be read");
    expect(skippedText(14)).toBe("14 repos could not be read");
  });

  it("property: every positive count gives a plain one-line sentence that starts with the count", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000 }), (n) => {
        const text = skippedText(n);
        expect(text).not.toBeNull();
        expect(text?.startsWith(`${n} repo`)).toBe(true);
        expect(text?.endsWith("could not be read")).toBe(true);
      }),
    );
  });
});