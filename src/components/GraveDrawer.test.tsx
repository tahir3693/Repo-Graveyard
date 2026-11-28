import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getSampleRepos } from "@/lib/demo/sample-repos";
import { buildDrawerFacts } from "@/lib/graveyard/drawer-facts";
import { buildGraveEntries } from "@/lib/graveyard/tombstones";
import { GraveDrawer } from "./GraveDrawer";

const NOW = new Date("2026-11-22T12:00:00.000Z");
const entry = buildGraveEntries(getSampleRepos(NOW), NOW).find((e) => e.repo.name === "ghost-ledger");
if (entry === undefined) throw new Error("sample repo missing");

const noop = () => undefined;

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
    expect(html).toMatch(/<button[^>]*class="btn btn-secondary drawer-close"[^>]*>.*Close<\/button>/);
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
