/**
 * Stone vocabulary: turns the scored data into the visual traits of one tombstone and into
 * their text equivalents (design-system.md, Visual vocabulary). Pure: no I/O, no clock,
 * no randomness. Components render these values and never read raw repo fields.
 */
import type { Status, Tombstone } from "@/lib/scoring";

export type StoneSize = "small" | "medium" | "large" | "grand";
export type FogStep = "none" | "light" | "medium" | "dense";

/** Smallest star count of each size step above `small`. Checked from the top. */
export const STONE_SIZE_MIN_STARS = { medium: 10, large: 100, grand: 1000 } as const;

export const STONE_SIZE_ORDER: readonly StoneSize[] = ["small", "medium", "large", "grand"];
export const FOG_ORDER: readonly FogStep[] = ["none", "light", "medium", "dense"];

export type StoneVocab = {
  size: StoneSize;
  fog: FogStep;
  cracks: boolean;
  vines: boolean;
  candle: boolean;
};

/** More stars never gives a smaller stone. Anything that is not a count is a small stone. */
export function stoneSizeForStars(stars: number): StoneSize {
  if (typeof stars !== "number" || !Number.isFinite(stars) || stars < 0) return "small";
  if (stars >= STONE_SIZE_MIN_STARS.grand) return "grand";
  if (stars >= STONE_SIZE_MIN_STARS.large) return "large";
  if (stars >= STONE_SIZE_MIN_STARS.medium) return "medium";
  return "small";
}

/**
 * Three fog steps from the scored fog level (days of silence). Alive repos have no fog.
 * The level itself comes from the scoring rules, so the thresholds live in one place.
 */
export function fogStepFor(status: Status, fogLevel: number): FogStep {
  if (status === "alive") return "none";
  if (!Number.isFinite(fogLevel) || fogLevel <= 0) return "none";
  if (fogLevel >= 1) return "dense";
  if (fogLevel >= 0.66) return "medium";
  return "light";
}

export function buildStoneVocab(tombstone: Tombstone, stars: number): StoneVocab {
  const { scene, status } = tombstone;
  return {
    size: stoneSizeForStars(stars),
    fog: fogStepFor(status, scene.fog),
    cracks: scene.cracks,
    vines: scene.vines,
    candle: scene.candle,
  };
}

function lowerFirst(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** Every visual trait in words, in a fixed order. Absent traits are left out to stay short. */
export function stoneTraitWords(vocab: StoneVocab): string[] {
  const words = [`${vocab.size} stone`];
  if (vocab.cracks) words.push("failing CI");
  if (vocab.vines) words.push("outdated dependencies");
  if (vocab.fog !== "none") words.push(`${vocab.fog} fog`);
  if (vocab.candle) words.push("recent activity");
  return words;
}

/** For example "todo-app, Dead, quietly retired, large stone, failing CI, dense fog". */
export function stoneAriaLabel(args: {
  name: string;
  statusLabel: string;
  cause: string;
  vocab: StoneVocab;
}): string {
  const { name, statusLabel, cause, vocab } = args;
  return [name, statusLabel, lowerFirst(cause), ...stoneTraitWords(vocab)].join(", ");
}
