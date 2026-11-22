import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraveyardError } from "./GraveyardError";

const noop = () => undefined;

describe("GraveyardError", () => {
  it.each([
    ["rate_limited", "GitHub asked the spirits to wait"],
    ["github_unavailable", "The graveyard cannot reach GitHub"],
    ["unauthorized", "The gates are locked until you sign in"],
    ["demo_unavailable", "The demo graveyard is sleeping"],
    [null, "The graveyard gates are stuck"],
  ])("shows a specific title for %s", (code, title) => {
    const html = renderToStaticMarkup(<GraveyardError code={code} demo={false} onRetry={noop} />);
    expect(html).toContain(title);
    expect(html).toContain("Try again");
  });

  it("links to the demo graveyard outside demo mode, and Sign in when signed out", () => {
    const html = renderToStaticMarkup(<GraveyardError code="unauthorized" demo={false} onRetry={noop} />);
    expect(html).toMatch(/<a href="\/graveyard\?demo=1"[^>]*>Try the demo graveyard<\/a>/);
    expect(html).toContain("Sign in with GitHub");
  });

  it("hides the demo link in demo mode but keeps Try again", () => {
    const html = renderToStaticMarkup(<GraveyardError code="demo_unavailable" demo onRetry={noop} />);
    expect(html).not.toContain("Try the demo graveyard");
    expect(html).toContain("Try again");
  });
});
