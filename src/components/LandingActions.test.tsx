import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LandingActions } from "./LandingActions";
import { NotSignedIn } from "./NotSignedIn";

describe("LandingActions", () => {
  it("signed out: shows Sign in and Try demo, no graveyard link or sign-out", () => {
    const html = renderToStaticMarkup(<LandingActions login={null} errorMessage={null} />);
    expect(html).toContain("Sign in with GitHub");
    expect(html).toContain("Try demo graveyard");
    expect(html).not.toContain("Open my graveyard");
    expect(html).not.toContain("Sign out");
    expect(html).not.toContain("Signed in as");
    expect(html).not.toContain('role="alert"');
  });

  it("signed in: shows Open my graveyard linking to /graveyard, the login and Sign out", () => {
    const html = renderToStaticMarkup(<LandingActions login="octocat" errorMessage={null} />);
    expect(html).toMatch(/<a href="\/graveyard"[^>]*>Open my graveyard<\/a>/);
    expect(html).toContain("Signed in as");
    expect(html).toContain("octocat");
    expect(html).toContain("Sign out");
    expect(html).not.toContain("Sign in with GitHub");
    expect(html).toContain("Try demo graveyard");
  });

  it("shows the error message and keeps the Sign in button", () => {
    const html = renderToStaticMarkup(
      <LandingActions login={null} errorMessage="The gate stayed shut." />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("The gate stayed shut.");
    expect(html).toContain("Sign in with GitHub");
  });
});

describe("NotSignedIn", () => {
  it("offers Sign in and a Try the demo link to /graveyard?demo=1", () => {
    const html = renderToStaticMarkup(<NotSignedIn />);
    expect(html).toContain("Sign in with GitHub");
    expect(html).toMatch(/<a href="\/graveyard\?demo=1"[^>]*>Try the demo<\/a>/);
    expect(html).not.toContain("gates are stuck");
  });
});
