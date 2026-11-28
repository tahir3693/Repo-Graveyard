/**
 * Rule-built fallback revival plan. Pure: no I/O, no clock, no randomness, no AI.
 * It builds the same shape as the model plan from the scored facts alone. Only counts,
 * flags and the filtered repo name reach the text. Check names, issue titles and README
 * text never do, because they are untrusted.
 */
import { containsBannedWord } from "@/lib/epitaphs";
import type { Status } from "@/lib/scoring";

import type { ContextBundle } from "./context";
import { FALLBACK_NAME_MAX, PLAN_FIELD_LIMITS } from "./limits";
import {
  RevivalPlanSchema,
  type Decision,
  type EffortLevel,
  type RevivalPlan,
} from "./plan";
import { capText, codePointLength } from "./text";

export type FallbackFacts = {
  name: string;
  status: Status;
  /** Days since the last commit, or null when unknown. */
  daysInactive: number | null;
  ciState: "passing" | "failing" | "none";
  failingChecks: number;
  /** null means unknown. */
  outdatedDeps: boolean | null;
  openIssues: number;
  archived: boolean;
  stars: number;
};

export function fallbackFactsFromBundle(bundle: ContextBundle): FallbackFacts {
  return {
    name: bundle.name,
    status: bundle.status,
    daysInactive: bundle.daysInactive,
    ciState: bundle.ci.state,
    failingChecks: bundle.ci.failingChecks.length,
    outdatedDeps: bundle.outdatedDeps,
    openIssues: bundle.openIssues,
    archived: bundle.archived,
    stars: bundle.stars,
  };
}

const GENERIC_LABEL = "this repo";

const STATE_TEXT: Readonly<Record<Status, string>> = {
  alive: "still warm",
  dying: "slowing down",
  dead: "quiet for a long while",
  ancient: "asleep for years",
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

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

type Step = { title: string; action: string; minutes: number; why: string };

/** Text for a step length. Lengths come from a short fixed list. */
export function effortText(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  if (minutes < 240) return `${minutes / 60} hours`;
  if (minutes === 240) return "half a day";
  return "a full day";
}

function step(title: string, action: string, minutes: number, why: string): Step {
  return { title, action, minutes, why };
}

const ARCHIVE_STEP = step(
  "Unarchive the repo",
  "Open the repo settings and turn off Archived so the repo accepts pushes again.",
  5,
  "An archived repo is read-only, so nothing else can start until it is open.",
);

function failingCiSteps(facts: FallbackFacts): Step[] {
  const which =
    facts.failingChecks > 0 ? ` (${plural(facts.failingChecks, "check")} failing)` : "";
  return [
    step(
      "Read the first red check",
      `Open the latest failing check${which} and read its first error line.`,
      15,
      "One error line usually shows where the repo stopped, and it costs almost nothing to read.",
    ),
    step(
      "Fix the first red check",
      "Fix or skip that one error, push, and watch the checks run again.",
      240,
      "Green checks make every later change safe to try.",
    ),
  ];
}

function outdatedDepsSteps(): Step[] {
  return [
    step(
      "List the outdated dependencies",
      "Run the package manager's outdated report and pick the package with the smallest update.",
      15,
      "A short list turns a vague worry into a first target.",
    ),
    step(
      "Update one dependency",
      "Update that one package, run the project and its tests, and fix the first break.",
      60,
      "One package at a time keeps any breakage easy to trace.",
    ),
  ];
}

function openIssuesStep(facts: FallbackFacts): Step {
  return step(
    "Read the open issues",
    `Read the ${plural(facts.openIssues, "open issue")}, close any that are no longer true, and pick one to do first.`,
    15,
    "Open issues are a ready-made to-do list left by people who cared.",
  );
}

const RUN_ONCE_STEP = step(
  "Run it once",
  "Run the project once and add one README line about what works today.",
  15,
  "A single run shows what survived the silence.",
);

const ADD_CI_STEP = step(
  "Add a minimal CI check",
  "Add one CI job that runs the tests, so every later change is checked.",
  60,
  "The repo has no CI checks, so nothing catches a regression yet.",
);

const MILESTONE_STEP = step(
  "Pick the next milestone",
  "Write down the one change that would make the repo feel done, and file it as an issue.",
  30,
  "A named finish line turns a paused repo into a small project.",
);

const SHIP_STEP = step(
  "Ship one small change",
  "Push the first fix and tag it, so the repo shows fresh activity.",
  30,
  "A visible push is the clearest sign that the repo is awake.",
);

const isQuiet = (facts: FallbackFacts) => facts.status !== "alive";

/** Signals in priority order: archived, failing CI, outdated dependencies, open issues, silence. */
function reviveSteps(facts: FallbackFacts): Step[] {
  const steps: Step[] = [];
  if (facts.archived) steps.push(ARCHIVE_STEP);
  if (facts.ciState === "failing") steps.push(...failingCiSteps(facts));
  if (facts.outdatedDeps === true) steps.push(...outdatedDepsSteps());
  if (facts.openIssues > 0) steps.push(openIssuesStep(facts));
  if (isQuiet(facts)) steps.push(RUN_ONCE_STEP);

  const fillers = [
    RUN_ONCE_STEP,
    ...(facts.ciState === "none" ? [ADD_CI_STEP] : []),
    MILESTONE_STEP,
    SHIP_STEP,
  ];
  for (const filler of fillers) {
    if (steps.length >= PLAN_FIELD_LIMITS.ROADMAP_MIN) break;
    if (!steps.includes(filler)) steps.push(filler);
  }
  return steps.slice(0, PLAN_FIELD_LIMITS.ROADMAP_MAX);
}

function archiveSteps(facts: FallbackFacts): Step[] {
  return [
    ...(facts.archived
      ? []
      : [
          step(
            "Archive the repo",
            "Open the repo settings and turn on Archived.",
            5,
            "Archiving tells visitors that the repo is resting, and it can be reopened any time.",
          ),
        ]),
    step(
      "Note its final state",
      "Add a short README note on what the repo did and what state it was left in.",
      15,
      "A clear last note saves a future visit from guessing.",
    ),
    step(
      "Save the useful bits",
      "Copy any snippet or idea worth keeping into a note or another repo.",
      15,
      "The good parts live on even while the repo rests.",
    ),
    step(
      "Set a reminder to look again",
      "Add a calendar reminder to look at the repo again later and decide whether to reopen it.",
      15,
      "A pause is easier to end when there is a date for it.",
    ),
  ];
}

// ---------------------------------------------------------------------------
// Verdict, diagnosis, wins, risks, effort
// ---------------------------------------------------------------------------

function isArchiveCase(facts: FallbackFacts): boolean {
  return facts.status === "ancient" && facts.stars === 0 && facts.openIssues === 0;
}

function verdictFor(facts: FallbackFacts): RevivalPlan["verdict"] {
  if (isArchiveCase(facts)) {
    return {
      decision: "archive",
      reason: facts.archived
        ? "Asleep for years with no stars and no open issues. It is already archived, so let it rest or reopen it any time."
        : "Asleep for years with no stars and no open issues. Archiving keeps it safe and easy to reopen.",
    };
  }
  switch (facts.status) {
    case "alive":
      return { decision: "revive", reason: "Still active. A small push keeps the momentum." };
    case "dying":
      return {
        decision: "revive",
        reason: "Activity is slowing, and a small step now keeps it from fading.",
      };
    case "dead":
      return {
        decision: "revive",
        reason: "Quiet for a long while, yet one small step can wake it.",
      };
    case "ancient":
      return {
        decision: "revive",
        reason: `Asleep for years, but ${plural(facts.stars, "star")} and ${plural(facts.openIssues, "open issue")} show that it still matters.`,
      };
  }
}

function lastCommitText(daysInactive: number | null): string {
  return daysInactive === null
    ? "its last commit date is unknown"
    : `its last commit was ${plural(daysInactive, "day")} ago`;
}

function signalParts(facts: FallbackFacts): string[] {
  const ci =
    facts.ciState === "failing"
      ? facts.failingChecks > 0
        ? `CI is failing (${plural(facts.failingChecks, "check")})`
        : "CI is failing"
      : facts.ciState === "passing"
        ? "CI is passing"
        : "there is no CI";
  const deps =
    facts.outdatedDeps === null
      ? "dependency state is unknown"
      : facts.outdatedDeps
        ? "dependencies are outdated"
        : "dependencies look current";
  return [
    ci,
    deps,
    plural(facts.openIssues, "open issue"),
    plural(facts.stars, "star"),
    ...(facts.archived ? ["the repo is archived"] : []),
  ];
}

function diagnosisFor(facts: FallbackFacts, label: string): string {
  const subject = label === GENERIC_LABEL ? "This repo" : label;
  const first = `${subject} is ${STATE_TEXT[facts.status]}, and ${lastCommitText(facts.daysInactive)}.`;
  const second = `Signals: ${signalParts(facts).join(", ")}.`;
  return `${first} ${second} It is paused, not gone.`;
}

function quickWinsFor(facts: FallbackFacts): string[] {
  const wins: string[] = [];
  if (isArchiveCase(facts)) {
    if (!facts.archived) wins.push("Archive the repo in its settings.");
    wins.push("Add one README line saying what the repo was.");
    wins.push("Copy any snippet worth keeping.");
    return wins.slice(0, PLAN_FIELD_LIMITS.QUICK_WINS_MAX);
  }
  if (facts.archived) wins.push("Unarchive the repo so it can take pushes.");
  if (facts.ciState === "failing") wins.push("Read the first error line of the failing check.");
  if (facts.outdatedDeps === true) wins.push("Update one outdated dependency and run the project.");
  if (facts.openIssues > 0) wins.push("Close any open issue that is no longer true.");
  if (isQuiet(facts)) wins.push("Add one README line saying what works today.");
  wins.push("Write the next small task at the top of the README.");
  wins.push("Run the project once and note what happens.");
  return wins.slice(0, PLAN_FIELD_LIMITS.QUICK_WINS_MAX);
}

function risksFor(facts: FallbackFacts): string[] {
  const risks: string[] = [];
  if (isArchiveCase(facts)) {
    risks.push("Archiving makes the repo read-only until it is reopened.");
  }
  if (facts.ciState === "failing") {
    risks.push(
      facts.failingChecks > 0
        ? `Fixing the first red check may reveal more red checks (${plural(facts.failingChecks, "check")} failing now).`
        : "Fixing the first red check may reveal more red checks.",
    );
  }
  if (facts.outdatedDeps === true) {
    risks.push("Updating dependencies can break the build, so update one package at a time.");
  }
  if (facts.outdatedDeps === null) {
    risks.push("Dependency state is unknown, so the first run may hold surprises.");
  }
  if (facts.daysInactive === null) risks.push("The last commit date is unknown.");
  if (facts.status === "dead" || facts.status === "ancient") {
    risks.push("After a long silence the original goal may no longer fit. Confirm it still matters first.");
  }
  if (facts.ciState === "none") {
    risks.push("There are no CI checks, so a regression may go unnoticed.");
  }
  risks.push("Scope can grow. Stop after the first step if time runs short.");
  return risks.slice(0, PLAN_FIELD_LIMITS.RISKS_MAX);
}

function effortFor(steps: readonly Step[]): RevivalPlan["effort"] {
  const minutes = steps.reduce((sum, s) => sum + s.minutes, 0);
  const level: EffortLevel = minutes <= 120 ? "low" : minutes <= 480 ? "medium" : "high";
  const total =
    minutes <= 60
      ? "about 1 hour"
      : minutes <= 120
        ? "about 2 hours"
        : minutes <= 240
          ? "half a day"
          : minutes <= 480
            ? "about a day"
            : "2 to 3 days";
  return { level, total };
}

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

function issueFocus(facts: FallbackFacts, decision: Decision): string {
  if (decision === "archive") return "write down what it was";
  if (facts.archived) return "unarchive and pick a first task";
  if (facts.ciState === "failing") return "get the checks green";
  if (facts.outdatedDeps === true) return "update dependencies";
  if (facts.openIssues > 0) return "sort the open issues";
  return "run it once";
}

function issueTitleFor(facts: FallbackFacts, decision: Decision, label: string): string {
  const verb = decision === "archive" ? "Archive" : "Revive";
  const long = `${verb} ${label}: ${issueFocus(facts, decision)}`;
  return codePointLength(long) <= 100 ? long : `${verb} ${label}`;
}

function issueBodyFor(label: string, verdict: RevivalPlan["verdict"], steps: readonly Step[]): string {
  const intro = `${label} is paused, not gone. Verdict: ${verdict.decision}. ${verdict.reason}`;
  const tasks = steps
    .map((s) => `- [ ] ${s.title} (${effortText(s.minutes)}): ${s.action}`)
    .join("\n");
  return `${intro}\n\nRoadmap:\n\n${tasks}`;
}

function labelsFor(facts: FallbackFacts, decision: Decision): string[] {
  if (decision === "archive") return ["archive"];
  const labels = ["revival"];
  if (facts.ciState === "failing") labels.push("ci");
  if (facts.outdatedDeps === true) labels.push("dependencies");
  if (facts.openIssues > 0) labels.push("triage");
  return labels.slice(0, PLAN_FIELD_LIMITS.LABELS_MAX);
}

function buildWithLabel(facts: FallbackFacts, label: string): RevivalPlan {
  const verdict = verdictFor(facts);
  const steps = verdict.decision === "archive" ? archiveSteps(facts) : reviveSteps(facts);
  return {
    verdict,
    diagnosis: diagnosisFor(facts, label),
    roadmap: steps.map((s) => ({
      title: s.title,
      action: s.action,
      effort: effortText(s.minutes),
      why: s.why,
    })),
    quickWins: quickWinsFor(facts),
    risks: risksFor(facts),
    effort: effortFor(steps),
    issue: {
      title: issueTitleFor(facts, verdict.decision, label),
      body: issueBodyFor(label, verdict, steps),
      labels: labelsFor(facts, verdict.decision),
    },
  };
}

/**
 * Same shape as the model plan. The filtered name is the only free text. If a name makes
 * the plan fail the schema (for example "www.x" reads as a link), the generic label is used.
 */
export function buildFallbackPlan(facts: FallbackFacts): RevivalPlan {
  const plan = buildWithLabel(facts, fallbackLabel(facts.name));
  if (RevivalPlanSchema.safeParse(plan).success) return plan;
  return buildWithLabel(facts, GENERIC_LABEL);
}
