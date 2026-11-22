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
    const html = renderToStaticMarkup(<GraveyardError code={code} onRetry={noop} />);
    expect(html).toContain(title);
    expect(html).toContain("Try again");
  });

  it("links to the demo graveyard on every failure and shows Sign in when signed out", () => {
    const html = renderToStaticMarkup(<GraveyardError code="unauthorized" onRetry={noop} />);
    expect(html).toMatch(/<a href="\/graveyard\?demo=1"[^>]*>Try the demo graveyard<\/a>/);
    expect(html).toContain("Sign in with GitHub");
  });

  it.each(["rate_limited", "github_unavailable", "demo_unavailable", "internal_error", null])(
    "offers both Try again and Try the demo graveyard for %s",
    (code) => {
      const html = renderToStaticMarkup(<GraveyardError code={code} onRetry={noop} />);
      expect(html).toContain("Try again");
      expect(html).toContain("Try the demo graveyard");
    },
  );
});