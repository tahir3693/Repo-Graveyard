/**
 * Epitaph module: template table, FNV-1a hash, template selection and filling.
 * Pure: no I/O, no clock, no randomness, no AI. Imports nothing from scoring.
 */

export const CAUSE_CODES = [
  "archived",
  "abandoned_failing_ci",
  "died_with_issues",
  "outdated_and_forgotten",
  "quietly_retired",
  "fading_health",
  "still_active",
] as const;

export type CauseCode = (typeof CAUSE_CODES)[number];

export type EpitaphFacts = {
  name: string;
  daysInactive: number | null; // null renders as "a long time"
  staleIssues: number;
  stars: number;
};

export type EpitaphFact = "days" | "issues" | "stars";

export type EpitaphTemplate = {
  text: string; // placeholders: {name} {days} {issues} {stars}
  needs: ReadonlyArray<EpitaphFact>;
};

export type GenerateEpitaphOptions = { requireFact?: "issues" };

const MAX_EPITAPH_LENGTH = 80;
const MAX_COUNT = 999_999_999;
const FALLBACK_NAME = "this repo";
const ELLIPSIS = "\u2026";
const UNKNOWN_DURATION = "a long time";

export const EPITAPH_TEMPLATES: Readonly<Record<CauseCode, ReadonlyArray<EpitaphTemplate>>> = {
  archived: [
    { text: "{name} is archived, resting until someone reopens it.", needs: [] },
    { text: "{name}: archived on purpose, ready to be unarchived.", needs: [] },
    { text: "Sealed with care. {name} can be reopened any time.", needs: [] },
  ],
  abandoned_failing_ci: [
    { text: "{name} rests with red tests. A fix could wake it.", needs: [] },
    { text: "Idle {days}, CI red. {name} is only paused.", needs: ["days"] },
    { text: "Red checks for {days}. {name} can be mended.", needs: ["days"] },
  ],
  died_with_issues: [
    { text: "{name} sleeps with {issues} open issues, only paused.", needs: ["issues"] },
    { text: "{issues} issues await a revival of {name}.", needs: ["issues"] },
    { text: "Open issues: {issues}. {name} is paused, not gone.", needs: ["issues"] },
    { text: "{name} rests with open issues, only paused.", needs: [] },
  ],
  outdated_and_forgotten: [
    { text: "Vines cover {name}'s old deps. Prune to revive.", needs: [] },
    { text: "Its dependencies slept for a year. {name} can wake.", needs: [] },
    { text: "{name} slept {days} with old packages, waiting.", needs: ["days"] },
  ],
  quietly_retired: [
    { text: "Asleep {days}. {name} awaits a free weekend.", needs: ["days"] },
    { text: "{name} retired quietly. Not gone, only waiting.", needs: [] },
    { text: "{name} holds {stars} stars. It can still shine.", needs: ["stars"] },
  ],
  fading_health: [
    { text: "{name} is fading, but only paused. It can wake.", needs: [] },
    { text: "{name} dims slowly. Not gone, only waiting.", needs: [] },
    { text: "Health fading for {days}. {name} is only resting.", needs: ["days"] },
  ],
  still_active: [
    { text: "{name} is awake and glowing. No grave needed.", needs: [] },
    { text: "{name} is still breathing. Last push {days} ago.", needs: ["days"] },
    { text: "{name} stirs. {stars} stars watch it rise.", needs: ["stars"] },
  ],
};

/** 32-bit FNV-1a over UTF-16 code units. */
export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Collapse whitespace runs, trim, and fall back to "this repo" when empty. */
export function normalizeName(name: string): string {
  const collapsed = String(name).replace(/\s+/g, " ").trim();
  return collapsed.length === 0 ? FALLBACK_NAME : collapsed;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isFactValid(fact: EpitaphFact, facts: EpitaphFacts): boolean {
  switch (fact) {
    case "days":
      return facts.daysInactive === null || isCount(facts.daysInactive);
    case "issues":
      return isCount(facts.staleIssues);
    case "stars":
      return isCount(facts.stars);
  }
}

/** Templates whose required facts are all valid. Null days is valid. */
export function eligibleTemplates(
  cause: CauseCode,
  facts: EpitaphFacts,
): ReadonlyArray<EpitaphTemplate> {
  return EPITAPH_TEMPLATES[cause].filter((template) =>
    template.needs.every((fact) => isFactValid(fact, facts)),
  );
}

function clampCount(value: unknown): number {
  return isCount(value) ? Math.min(value, MAX_COUNT) : 0;
}

function renderDays(days: number | null): string {
  if (days === null || !isCount(days)) return UNKNOWN_DURATION;
  const clamped = Math.min(days, MAX_COUNT);
  return clamped === 1 ? "1 day" : `${clamped} days`;
}

function substitute(template: EpitaphTemplate, facts: EpitaphFacts, name: string): string {
  return template.text.replace(/\{(name|days|issues|stars)\}/g, (_match, key: string) => {
    switch (key) {
      case "name":
        return name;
      case "days":
        return renderDays(facts.daysInactive);
      case "issues":
        return String(clampCount(facts.staleIssues));
      default:
        return String(clampCount(facts.stars));
    }
  });
}

/** Cut by whole code points so the result, with the ellipsis, is at most `budget` UTF-16 units. */
function truncateName(name: string, budget: number): string {
  if (name.length <= budget) return name;
  let result = "";
  for (const point of name) {
    if (result.length + point.length + ELLIPSIS.length > budget) break;
    result += point;
  }
  return result + ELLIPSIS;
}

/** Fill one template. Only the name is ever truncated. */
export function fillTemplate(template: EpitaphTemplate, facts: EpitaphFacts): string {
  const name = normalizeName(facts.name);
  const fixedLength = substitute(template, facts, "").length;
  const budget = Math.max(MAX_EPITAPH_LENGTH - fixedLength, ELLIPSIS.length);
  return substitute(template, facts, truncateName(name, budget));
}

export function generateEpitaph(
  cause: CauseCode,
  facts: EpitaphFacts,
  options?: GenerateEpitaphOptions,
): string {
  const eligible = eligibleTemplates(cause, facts);
  const required = options?.requireFact;
  const preferred = required
    ? eligible.filter((template) => template.needs.includes(required))
    : eligible;
  const pool = preferred.length > 0 ? preferred : eligible;
  const template = pool[fnv1a32(String(facts.name)) % pool.length];
  return fillTemplate(template, facts);
}
