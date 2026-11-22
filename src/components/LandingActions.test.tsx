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

  it("shows the not-set-up message and keeps the Sign in button when auth env is missing", () => {
    const html = renderToStaticMarkup(
      <LandingActions login={null} errorMessage={null} signInConfigured={false} />,
    );
    expect(html).toContain("GitHub sign-in is not set up on this server yet. Try the demo graveyard.");
    expect(html).toContain("Sign in with GitHub");
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Try demo graveyard");
  });

  it("hides the not-set-up message when sign-in is configured", () => {
    const html = renderToStaticMarkup(<LandingActions login={null} errorMessage={null} />);
    expect(html).not.toContain("not set up");
    expect(html).not.toContain("aria-disabled");
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
  it("offers Sign in and a Try the demo graveyard link to /graveyard?demo=1", () => {
    const html = renderToStaticMarkup(<NotSignedIn />);
    expect(html).toContain("Sign in with GitHub");
    expect(html).toMatch(/<a href="\/graveyard\?demo=1"[^>]*>Try the demo graveyard<\/a>/);
    expect(html).not.toContain("gates are stuck");
  });

  it("explains a missing server setup inline and keeps the demo link", () => {
    const html = renderToStaticMarkup(<NotSignedIn signInConfigured={false} />);
    expect(html).toContain("GitHub sign-in is not set up on this server yet. Try the demo graveyard.");
    expect(html).toContain("Sign in with GitHub");
    expect(html).toContain("Try the demo graveyard</a>");
  });
});
