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

  it("starts closed and open to the user: no closing class until Close is asked for", () => {
    expect(html).toMatch(/<dialog[^>]*class="drawer"/);
    expect(html).not.toContain("drawer-closing");
  });
});

describe("GraveDrawer badge once a revival plan has arrived", () => {
  function drawer(reviving: boolean) {
    return renderToStaticMarkup(
      <GraveDrawer
        name={entry!.repo.name}
        status={entry!.tombstone.status}
        score={entry!.tombstone.score}
        causeLabel={entry!.tombstone.cause.label}
        epitaph={entry!.tombstone.epitaph}
        facts={buildDrawerFacts(entry!.repo, entry!.tombstone)}
        url={entry!.repo.url}
        reviving={reviving}
        onClose={noop}
      />,
    );
  }

  const badge = (html: string) => /<span class="drawer-status[^"]*">.*?<\/span>/.exec(html)?.[0] ?? "";

  it("says Reviving with a flame instead of the death status", () => {
    const html = badge(drawer(true));
    expect(html).toContain("drawer-status-reviving");
    expect(html).toContain(">Reviving<");
    expect(html).not.toContain("Dead");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"[^>]*><path d="M8 1\.5C/);
  });

  it("uses a different shape from the death badge, so the change never relies on color alone", () => {
    const shape = (html: string) => /<(path|rect|circle)[^>]*>/.exec(badge(html))?.[0];
    expect(shape(drawer(true))).not.toBe(shape(drawer(false)));
  });

  it("keeps the Dead badge, the score and the cause when no plan has arrived", () => {
    const html = drawer(false);
    expect(badge(html)).toContain("drawer-status-failing");
    expect(badge(html)).toContain(">Dead<");
    expect(html).not.toContain("Reviving");
  });

  it("never changes the death score or the cause: they are rule results, not a mood", () => {
    for (const reviving of [true, false]) {
      const html = drawer(reviving);
      expect(html).toContain(`Death score ${entry!.tombstone.score} of 100`);
      expect(html).toContain(entry!.tombstone.cause.label);
    }
  });
});
