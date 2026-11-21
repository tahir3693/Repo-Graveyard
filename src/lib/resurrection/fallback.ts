/**
 * Rule-built fallback revival plan. Pure: no I/O, no clock, no randomness, no AI.
 * Every text is fixed per cause code. Only `name` (filtered), `causeCode` and `status`
 * influence the output.
 */
import { containsBannedWord, type CauseCode } from "@/lib/epitaphs";
import type { Status } from "@/lib/scoring";

import { FALLBACK_NAME_MAX } from "./limits";
import type { Effort, RevivalPlan } from "./plan";
import { capText } from "./text";

export type FallbackFacts = { name: string; causeCode: CauseCode; status: Status };

/** Placeholders: `{name}` (filtered label) and `{state}` (from status). */
export type FallbackTemplate = {
  diagnosis: string;
  smallestNextStep: string;
  effort: Effort;
  issueTitle: string;
  issueBody: string;
};

const GENERIC_LABEL = "this repo";

const STATE_TEXT: Readonly<Record<Status, string>> = {
  alive: "still warm",
  dying: "slowing down",
  dead: "quiet for a long while",
  ancient: "asleep for years",
};

/**
 * One template per `CauseCode`. `fading_health` was added after the design's
 * six-row table, because death-scoring now has seven causes.
 */
export const FALLBACK_TEMPLATES: Readonly<Record<CauseCode, FallbackTemplate>> = {
  archived: {
    diagnosis:
      "{name} is archived and {state}. Archiving is a pause button, so it can be reopened whenever the time is right.",
    smallestNextStep: "Unarchive the repo in its settings, then write down one small first task.",
    effort: "under 1 hour",
    issueTitle: "Revive {name}: unarchive and pick a first task",
    issueBody:
      "{name} is archived and {state}. It is paused, not gone, and a small step can bring it back.\n\n- [ ] Unarchive the repository in its settings\n- [ ] Write down one small first task\n- [ ] Finish that task and push it",
  },
  abandoned_failing_ci: {
    diagnosis:
      "{name} is {state}, and its latest checks are red. Red checks are a clue, not a verdict, and one fix can turn them around.",
    smallestNextStep:
      "Open the latest failing check, read its first error line, and fix or skip that one step.",
    effort: "a weekend",
    issueTitle: "Revive {name}: get the checks green",
    issueBody:
      "{name} is {state} and its latest checks are red. Fixing one step at a time is enough to wake it.\n\n- [ ] Open the latest failing check\n- [ ] Read the first error line\n- [ ] Fix or skip that one step\n- [ ] Push and watch the checks run again",
  },
  died_with_issues: {
    diagnosis:
      "{name} is {state} and still has open issues waiting. They show that people cared, and they make a ready-made to-do list.",
    smallestNextStep:
      "Read the open issues, close the ones that are no longer true, and pick one to do first.",
    effort: "a weekend",
    issueTitle: "Revive {name}: sort the open issues",
    issueBody:
      "{name} is {state} and has open issues waiting. A short triage turns them into a plan.\n\n- [ ] Read the open issues\n- [ ] Close the ones that are no longer true\n- [ ] Pick one issue to do first\n- [ ] Finish it and say so in the thread",
  },
  outdated_and_forgotten: {
    diagnosis:
      "{name} is {state} and its dependencies have aged. Old packages are only dust, and a careful update brushes it off.",
    smallestNextStep: "Update one dependency, run the project, and note what broke.",
    effort: "a weekend",
    issueTitle: "Revive {name}: update one dependency",
    issueBody:
      "{name} is {state} and its dependencies are out of date. Small updates keep it manageable.\n\n- [ ] Pick one outdated dependency\n- [ ] Update it and run the project\n- [ ] Note what broke\n- [ ] Fix the first break",
  },
  quietly_retired: {
    diagnosis:
      "{name} is {state} and has retired quietly. Nothing is broken about a rest, and it can come back at its own pace.",
    smallestNextStep: "Run the project once, then add one line to the README saying what works today.",
    effort: "under 1 hour",
    issueTitle: "Revive {name}: run it once and note the state",
    issueBody:
      "{name} is {state} and has retired quietly. One short session is enough to see where it stands.\n\n- [ ] Run the project once\n- [ ] Add one line to the README about what works today\n- [ ] Choose the next small task",
  },
  fading_health: {
    diagnosis:
      "{name} is {state} and its health is fading. It is dimming, not dark, and a little attention can bring the glow back.",
    smallestNextStep:
      "Run the project and its tests once, write down the first thing that breaks, and fix only that.",
    effort: "a weekend",
    issueTitle: "Revive {name}: fix the first thing that breaks",
    issueBody:
      "{name} is {state} and its health is fading. Catching it early keeps the revival small.\n\n- [ ] Run the project and its tests once\n- [ ] Write down the first thing that breaks\n- [ ] Fix only that one thing\n- [ ] Push the fix",
  },
  still_active: {
    diagnosis:
      "{name} is {state} and still active. It does not need a grave, only a small push to keep its momentum.",
    smallestNextStep: "Pick one small task from the issue list and finish it this week.",
    effort: "a week or more",
    issueTitle: "Revive {name}: finish one small task",
    issueBody:
      "{name} is {state} and still active. One finished task keeps it that way.\n\n- [ ] Pick one small task from the issue list\n- [ ] Finish it this week\n- [ ] Note what comes next",
  },
};

/** Safe display name: `[A-Za-z0-9._ -]` only, at most 60 code points, never a banned word. */
export function fallbackLabel(name: string): string {
  const label = capText(name, FALLBACK_NAME_MAX)
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
  if (label === "" || containsBannedWord(label)) return GENERIC_LABEL;
  return label;
}

function fill(template: string, label: string, state: string): string {
  // Function replacers keep "$" sequences in the label literal.
  return template.replace(/\{name\}/g, () => label).replace(/\{state\}/g, () => state);
}

export function buildFallbackPlan(facts: FallbackFacts): RevivalPlan {
  const template = FALLBACK_TEMPLATES[facts.causeCode];
  const label = fallbackLabel(facts.name);
  const state = STATE_TEXT[facts.status];
  return {
    diagnosis: fill(template.diagnosis, label, state),
    smallestNextStep: template.smallestNextStep,
    effort: template.effort,
    issueTitle: fill(template.issueTitle, label, state),
    issueBody: fill(template.issueBody, label, state),
  };
}
