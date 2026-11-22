import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getSampleRepos } from "@/lib/demo/sample-repos";
import { buildDrawerFacts } from "@/lib/graveyard/drawer-facts";
import { buildGraveEntries } from "@/lib/graveyard/tombstones";
import type { RevivalPlanData } from "@/lib/graveyard/resurrect-state";
import { GraveDrawer } from "./GraveDrawer";
import {
  COPIED_MESSAGE,
  COPY_FAILED_MESSAGE,
  DEMO_ISSUE_NOTE,
  FILED_MESSAGE,
  FILING_MESSAGE,
  ResurrectPlan,
  issueStatusMessage,
} from "./ResurrectPlan";

const NOW = new Date("2026-11-22T12:00:00.000Z");
const entry = buildGraveEntries(getSampleRepos(NOW), NOW).find((e) => e.repo.name === "ghost-ledger");
if (entry === undefined) throw new Error("sample repo missing");

const noop = () => undefined;

const PLAN: RevivalPlanData = {
  diagnosis: "Paused after the tests turned red.",
  smallestNextStep: "Fix the first failing test.",
  effort: "a weekend",
  issueTitle: "Revive ghost-ledger: fix CI",
  issueBody: "Start with the first red check.",
};

function plan(over: { demo?: boolean; issue?: Parameters<typeof ResurrectPlan>[0]["issue"]; copy?: "idle" | "copied" | "failed" } = {}) {
  return renderToStaticMarkup(
    <ResurrectPlan
      plan={PLAN}
      demo={over.demo ?? false}
      issue={over.issue ?? { phase: "idle" }}
      copy={over.copy ?? "idle"}
      idPrefix="t"
      onCopy={noop}
      onFile={noop}
    />,
  );
}

describe("GraveDrawer", () => {
  const html = renderToStaticMarkup(
    <GraveDrawer
      name={entry.repo.name}
      status={entry.tombstone.status}
      score={entry.tombstone.score}
      causeLabel={entry.tombstone.cause.label}
      epitaph={entry.tombstone.epitaph}
      facts={buildDrawerFacts(entry.repo, entry.tombstone)}
      url={entry.repo.url}
      onClose={noop}
    >
      <p>slot content</p>
    </GraveDrawer>,
  );

  it("is a labelled modal dialog with the repo name as its only heading label", () => {
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/<h2[^>]*>ghost-ledger<\/h2>/);
  });

  it("shows a status badge with a shape and a word, a one-line cause and a Close button", () => {
    expect(html).toMatch(/drawer-status[^"]*"[^>]*><svg[^>]*aria-hidden="true"/);
    expect(html).toContain(">Dead<");
    expect(html).toContain("Death score");
    expect(html).toContain("Cause of death:");
    expect(html).toContain(entry.tombstone.cause.label);
    expect(html).toMatch(/<button[^>]*class="drawer-close"[^>]*>.*Close<\/button>/);
  });

  it("lists the five facts, with failing CI spelled out", () => {
    for (const label of ["Last commit", "Stars", "CI", "Dependencies", "Open issues"]) {
      expect(html).toContain(`<dt>${label}</dt>`);
    }
    expect(html).toContain("Failing");
  });

  it("puts the facts before the slot (the Resurrect area) and keeps the header outside the scroll area", () => {
    expect(html.indexOf("drawer-top")).toBeLessThan(html.indexOf("drawer-body"));
    expect(html.indexOf("drawer-facts")).toBeLessThan(html.indexOf("slot content"));
  });
});

describe("ResurrectPlan", () => {
  it("shows the four separate blocks in order", () => {
    const html = plan();
    const order = ["Diagnosis", "Smallest next step", "Time estimate", "Drafted issue"].map((t) => html.indexOf(`>${t}<`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain("A weekend");
    expect(html).toContain("Revival plan");
  });

  it("offers Copy issue, and File this issue enabled when signed in", () => {
    const html = plan({ demo: false });
    expect(html).toContain("Copy issue");
    expect(html).toMatch(/<button[^>]*>File this issue<\/button>/);
    expect(html).not.toMatch(/<button[^>]*aria-disabled="true"[^>]*>File this issue/);
    expect(html).not.toContain(DEMO_ISSUE_NOTE);
  });

  it("in demo mode disables File this issue and explains why", () => {
    const html = plan({ demo: true });
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>File this issue<\/button>/);
    expect(html).toContain("Filing issues is turned off in the demo.");
    expect(html).toMatch(/aria-describedby="t-demo-note"/);
    expect(html).toContain('id="t-demo-note"');
  });

  it("shows a visible Copied confirmation", () => {
    const html = plan({ copy: "copied" });
    expect(html).toContain("Copied");
    expect(html).not.toContain(">Copy issue<");
    expect(html).toContain(COPIED_MESSAGE);
  });

  it("always renders the polite live region, empty when there is nothing to say", () => {
    expect(plan()).toMatch(/<p class="resurrect-note" role="status" aria-live="polite"><\/p>/);
  });

  it("long unbroken text renders in wrapping blocks and the issue body is a focusable scroll region", () => {
    const long = "x".repeat(5000);
    const html = renderToStaticMarkup(
      <ResurrectPlan
        plan={{ ...PLAN, diagnosis: long, issueBody: long }}
        demo={false}
        issue={{ phase: "idle" }}
        copy="idle"
        idPrefix="t"
        onCopy={noop}
        onFile={noop}
      />,
    );
    expect(html).toContain(long);
    expect(html).toMatch(/class="resurrect-issue-body"[^>]*role="region"[^>]*tabindex="0"/);
  });
});

describe("issueStatusMessage", () => {
  it.each([
    [{ phase: "pending" } as const, "idle" as const, FILING_MESSAGE],
    [{ phase: "filed", url: null } as const, "idle" as const, FILED_MESSAGE],
    [{ phase: "idle" } as const, "copied" as const, COPIED_MESSAGE],
    [{ phase: "idle" } as const, "failed" as const, COPY_FAILED_MESSAGE],
    [{ phase: "idle" } as const, "idle" as const, null],
    [{ phase: "pending" } as const, "copied" as const, FILING_MESSAGE],
  ])("%j with copy %s says %s", (issue, copy, expected) => {
    expect(issueStatusMessage(issue, copy)).toBe(expected);
  });
});
