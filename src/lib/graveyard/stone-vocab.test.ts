import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { RepoHealth } from "@/lib/github/repo-health";
import { scoreRepo } from "@/lib/scoring";
import {
  buildStoneVocab,
  FOG_ORDER,
  fogStepFor,
  STONE_SIZE_MIN_STARS,
  STONE_SIZE_ORDER,
  stoneAriaLabel,
  stoneSizeForStars,
  stoneTraitWords,
  type StoneVocab,
} from "./stone-vocab";

const NOW = new Date("2025-06-01T00:00:00Z");
const MS_PER_DAY = 86_400_000;

function repo(over: Partial<RepoHealth> & { daysAgo?: number } = {}): RepoHealth {
  const { daysAgo = 400, ...rest } = over;
  return {
    name: "todo-app",
    url: "https://example.com/todo-app",
    description: null,
    lastCommitAt: new Date(NOW.getTime() - daysAgo * MS_PER_DAY).toISOString(),
    openIssues: 0,
    archived: false,
    ciStatus: "none",
    hasReadme: true,
    outdatedDeps: false,
    stars: 0,
    language: null,
    ...rest,
  };
}

const rank = (size: ReturnType<typeof stoneSizeForStars>) => STONE_SIZE_ORDER.indexOf(size);
const fogRank = (fog: ReturnType<typeof fogStepFor>) => FOG_ORDER.indexOf(fog);

describe("stoneSizeForStars", () => {
  it.each([
    [0, "small"],
    [9, "small"],
    [10, "medium"],
    [99, "medium"],
    [100, "large"],
    [999, "large"],
    [1000, "grand"],
    [250_000, "grand"],
  ] as const)("%i stars is a %s stone", (stars, size) => {
    expect(stoneSizeForStars(stars)).toBe(size);
  });

  it("treats values that are not counts as a small stone", () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(stoneSizeForStars(bad)).toBe("small");
    }
  });

  it("uses exactly the documented thresholds", () => {
    expect(STONE_SIZE_MIN_STARS).toEqual({ medium: 10, large: 100, grand: 1000 });
  });

  it("property: more stars never gives a smaller stone", () => {
    fc.assert(
      fc.property(fc.nat(2_000_000), fc.nat(2_000_000), (a, b) => {
        const [low, high] = a <= b ? [a, b] : [b, a];
        expect(rank(stoneSizeForStars(low))).toBeLessThanOrEqual(rank(stoneSizeForStars(high)));
      }),
    );
  });

  it("property: the result is always one of the four sizes", () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer(), fc.double({ noNaN: false })), (stars) => {
        expect(STONE_SIZE_ORDER).toContain(stoneSizeForStars(stars));
      }),
    );
  });
});

describe("fogStepFor", () => {
  it("gives alive repos no fog at any level", () => {
    for (const level of [0, 0.33, 0.66, 1]) expect(fogStepFor("alive", level)).toBe("none");
  });

  it.each([
    [0, "none"],
    [0.33, "light"],
    [0.66, "medium"],
    [1, "dense"],
  ] as const)("level %s on a dead repo is %s fog", (level, step) => {
    expect(fogStepFor("dead", level)).toBe(step);
  });

  it("property: denser scored fog never gives thinner fog", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("dying", "dead", "ancient"),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (status, a, b) => {
          const [low, high] = a <= b ? [a, b] : [b, a];
          expect(fogRank(fogStepFor(status, low))).toBeLessThanOrEqual(fogRank(fogStepFor(status, high)));
        },
      ),
    );
  });

  it("property: more days of silence never gives thinner fog (through the real scoring)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3000 }),
        fc.integer({ min: 0, max: 3000 }),
        fc.constantFrom("passing", "failing", "none"),
        fc.boolean(),
        (a, b, ciStatus, outdated) => {
          const [low, high] = a <= b ? [a, b] : [b, a];
          const fogOf = (days: number) => {
            const base = repo({ daysAgo: days, ciStatus, outdatedDeps: outdated });
            return buildStoneVocab(scoreRepo(base, NOW), base.stars).fog;
          };
          expect(fogRank(fogOf(low))).toBeLessThanOrEqual(fogRank(fogOf(high)));
        },
      ),
    );
  });
});

describe("buildStoneVocab", () => {
  it("reads every trait from the scored data and the star count", () => {
    const health = repo({ daysAgo: 500, ciStatus: "failing", outdatedDeps: true, stars: 120 });
    const vocab = buildStoneVocab(scoreRepo(health, NOW), health.stars);
    expect(vocab).toEqual({ size: "large", fog: "dense", cracks: true, vines: true, candle: false });
  });

  it("shows a candle and no fog, cracks or vines for a recently active healthy repo", () => {
    const health = repo({ daysAgo: 3, ciStatus: "passing", stars: 4 });
    const vocab = buildStoneVocab(scoreRepo(health, NOW), health.stars);
    expect(vocab).toEqual({ size: "small", fog: "none", cracks: false, vines: false, candle: true });
  });

  it("is deterministic", () => {
    const health = repo({ daysAgo: 200, stars: 55 });
    const t = scoreRepo(health, NOW);
    expect(buildStoneVocab(t, 55)).toEqual(buildStoneVocab(t, 55));
  });
});

describe("stoneAriaLabel", () => {
  const full: StoneVocab = { size: "large", fog: "dense", cracks: true, vines: true, candle: false };

  it("says every visual trait in words", () => {
    expect(
      stoneAriaLabel({ name: "todo-app", statusLabel: "Dead", cause: "Quietly retired", vocab: full }),
    ).toBe("todo-app, Dead, quietly retired, large stone, failing CI, outdated dependencies, dense fog");
  });

  it("leaves out traits that are absent and names the candle as recent activity", () => {
    const vocab: StoneVocab = { size: "small", fog: "none", cracks: false, vines: false, candle: true };
    expect(stoneAriaLabel({ name: "moonlit-notes", statusLabel: "Alive", cause: "Still active", vocab })).toBe(
      "moonlit-notes, Alive, still active, small stone, recent activity",
    );
  });

  it("starts with the name and the status, so stones stay findable by name", () => {
    expect(stoneAriaLabel({ name: "x", statusLabel: "Ancient", cause: "Archived and laid to rest", vocab: full })).toMatch(
      /^x, Ancient, /,
    );
  });

  it("property: every true trait appears as words, every false trait does not", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STONE_SIZE_ORDER),
        fc.constantFrom(...FOG_ORDER),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (size, fog, cracks, vines, candle) => {
          const words = stoneTraitWords({ size, fog, cracks, vines, candle });
          expect(words).toContain(`${size} stone`);
          expect(words.includes("failing CI")).toBe(cracks);
          expect(words.includes("outdated dependencies")).toBe(vines);
          expect(words.includes("recent activity")).toBe(candle);
          expect(words.some((w) => w.endsWith(" fog"))).toBe(fog !== "none");
        },
      ),
    );
  });
});
