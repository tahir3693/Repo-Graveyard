import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraveyardControls } from "./GraveyardControls";
import { GraveyardHeader } from "./GraveyardHeader";
import { GraveyardSkeleton } from "./GraveyardSkeleton";

const noop = () => undefined;
const counts = { alive: 3, dying: 4, dead: 3, ancient: 2, total: 12 };

describe("GraveyardHeader", () => {
  it("has one h1, the summary, a back link and no badge or sign out by default", () => {
    const html = renderToStaticMarkup(
      <GraveyardHeader summary="12 repos: 3 alive, 4 dying, 3 dead, 2 ancient" badge={null} login={null} />,
    );
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("The Graveyard");
    expect(html).toContain("12 repos: 3 alive, 4 dying, 3 dead, 2 ancient");
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>.*Back to home/);
    expect(html).not.toContain("Sign out");
    expect(html).not.toContain("graveyard-badge");
  });

  it("shows how many repos could not be read, only when there are some", () => {
    const some = renderToStaticMarkup(<GraveyardHeader summary="8 repos" badge={null} login={null} skippedCount={3} />);
    expect(some).toContain(">3 repos could not be read</p>");
    const one = renderToStaticMarkup(<GraveyardHeader summary="8 repos" badge={null} login={null} skippedCount={1} />);
    expect(one).toContain(">1 repo could not be read</p>");
    for (const html of [
      renderToStaticMarkup(<GraveyardHeader summary="8 repos" badge={null} login={null} skippedCount={0} />),
      renderToStaticMarkup(<GraveyardHeader summary="8 repos" badge={null} login={null} />),
    ]) {
      expect(html).not.toContain("could not be read");
    }
  });

  it.each(["Demo", "Sample repos"] as const)("shows the %s badge", (badge) => {
    const html = renderToStaticMarkup(<GraveyardHeader summary={null} badge={badge} login={null} />);
    expect(html).toContain(`>${badge}</p>`);
  });

  it("shows the login and a Sign out button when signed in", () => {
    const html = renderToStaticMarkup(<GraveyardHeader summary={null} badge={null} login="octocat" />);
    expect(html).toContain("octocat");
    expect(html).toContain("Sign out");
  });
});

describe("GraveyardControls", () => {
  it("renders five filter buttons with aria-pressed and marks only the active one", () => {
    const html = renderToStaticMarkup(
      <GraveyardControls filter="dying" sort="newest" counts={counts} onFilter={noop} onSort={noop} />,
    );
    for (const label of ["All", "Alive", "Dying", "Dead", "Ancient"]) expect(html).toContain(label);
    expect(html.match(/<button[^>]*aria-pressed/g)).toHaveLength(5);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>(?:<span[^>]*aria-hidden="true">\u2713<\/span>)?Dying/);
  });

  it("shows the count on each chip", () => {
    const html = renderToStaticMarkup(
      <GraveyardControls filter="all" sort="newest" counts={counts} onFilter={noop} onSort={noop} />,
    );
    expect(html).toContain(">12</span>");
    expect(html).toContain(">4</span>");
  });

  it("has a labelled sort select with the three options", () => {
    const html = renderToStaticMarkup(
      <GraveyardControls filter="all" sort="stars" counts={counts} onFilter={noop} onSort={noop} />,
    );
    expect(html).toContain("Sort by");
    for (const option of ["Newest activity", "Oldest activity", "Most stars"]) {
      expect(html).toContain(option);
    }
    expect(html).toMatch(/<option value="stars" selected/);
  });
});

describe("GraveyardSkeleton", () => {
  it("announces loading once and hides the placeholder stones from screen readers", () => {
    const html = renderToStaticMarkup(<GraveyardSkeleton />);
    expect(html).toContain("Digging up the graveyard");
    expect(html).toContain('role="status"');
    expect(html).toMatch(/<ul[^>]*aria-hidden="true"/);
    expect(html.match(/graveyard-skeleton"/g)?.length).toBeGreaterThanOrEqual(6);
    expect(html).not.toContain("<button");
  });
});
