export type CiStatus = "passing" | "failing" | "none";

export const OUTDATED_MANIFEST_DAYS = 365;

const MS_PER_DAY = 86_400_000;
const FAILING_CONCLUSIONS: ReadonlySet<string> = new Set(["failure", "timed_out", "startup_failure"]);

export function deriveCiStatus(conclusions: ReadonlyArray<string | null>): CiStatus {
  if (conclusions.length === 0) return "none";
  const failing = conclusions.some((c) => c !== null && FAILING_CONCLUSIONS.has(c));
  return failing ? "failing" : "passing";
}

export function deriveOutdatedDeps(manifestCommittedAt: string | null, now: Date): boolean | null {
  if (manifestCommittedAt === null) return null;
  const committed = Date.parse(manifestCommittedAt);
  if (Number.isNaN(committed)) return null;
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) return null;
  return nowMs - committed > OUTDATED_MANIFEST_DAYS * MS_PER_DAY;
}
