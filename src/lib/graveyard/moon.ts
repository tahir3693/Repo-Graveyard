/** Lowest moon opacity, so the moon never vanishes when no repo is alive. */
export const MOON_MIN = 0.25;

/**
 * Moon and sky brightness from the share of alive repos, from MOON_MIN to 1.
 * Pure: the same counts always give the same number. Invalid input gives MOON_MIN.
 */
export function moonBrightness(alive: number, total: number): number {
  if (!Number.isFinite(alive) || !Number.isFinite(total) || total <= 0) {
    return MOON_MIN;
  }
  const share = Math.min(Math.max(alive / total, 0), 1);
  return MOON_MIN + (1 - MOON_MIN) * share;
}