// Upstream verification (task 1.1): all assumed names exist in the installed packages.
// Differences from the tasks.md assumptions:
// - `@/lib/scoring` is the single file `src/lib/scoring.ts`, not a folder. The import path still resolves.
// - `readAuthEnv` lives in `@/lib/env` (`src/lib/env.ts`).
// - `src/lib/graveyard/client.ts` already defines its own `ScanSuccessSchema`. This spec should import the
//   one from `@/lib/scan/response` when it needs the scan schema.
// - framer-motion 14.14.0 exports MotionConfig, LazyMotion, domAnimation, m, AnimatePresence, useReducedMotion.
import type { RepoHealth } from "@/lib/github/repo-health";
import type { Status, Tombstone } from "@/lib/scoring";

export type GraveEntry = { repo: RepoHealth; tombstone: Tombstone };

export type LanguageFilter =
  | { kind: "all" }
  | { kind: "unknown" }
  | { kind: "named"; value: string };

export type Filters = { statuses: readonly Status[]; language: LanguageFilter };

export type SortOrder =
  | "score-desc"
  | "score-asc"
  | "name-asc"
  | "stars-desc"
  | "silence-desc";

export type ViewMode = "scene" | "list";

export const NO_FILTERS: Filters = { statuses: [], language: { kind: "all" } };
