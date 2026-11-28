import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyGraveArt, LanternArt } from "./StateArt";

// Emoji and pictographs are not allowed as illustrations (design-system.md).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("LanternArt", () => {
  it("is a decorative svg: hidden from assistive tech and not focusable", () => {
    const html = renderToStaticMarkup(<LanternArt lit />);
    expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(html).toContain('focusable="false"');
    expect(html).not.toMatch(/<title|aria-label|role=/);
  });

  it("draws a flame and a halo when lit, and only an outline when unlit", () => {
    const lit = renderToStaticMarkup(<LanternArt lit />);
    expect(lit).toContain('data-lit="true"');
    expect(lit).toContain("state-art-flame");
    expect(lit).toContain("state-art-halo");
    const unlit = renderToStaticMarkup(<LanternArt lit={false} />);
    expect(unlit).toContain('data-lit="false"');
    expect(unlit).toContain("state-art-flame-off");
    expect(unlit).not.toContain("state-art-halo");
    expect(unlit).not.toContain('class="state-art-flame"');
  });

  it("only breathes when asked to", () => {
    expect(renderToStaticMarkup(<LanternArt lit pulsing />)).toContain("state-art-pulse");
    expect(renderToStaticMarkup(<LanternArt lit />)).not.toContain("state-art-pulse");
  });
});

describe("EmptyGraveArt", () => {
  it("is a decorative svg with an arched stone and a mound", () => {
    const html = renderToStaticMarkup(<EmptyGraveArt />);
    expect(html).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(html).toContain("state-art-grave");
    expect((html.match(/<path/g) ?? []).length).toBe(3);
  });
});

describe("illustrations carry no raw colors and no emoji", () => {
  it.each([
    ["lit lantern", <LanternArt key="a" lit pulsing />],
    ["unlit lantern", <LanternArt key="b" lit={false} />],
    ["empty grave", <EmptyGraveArt key="c" />],
  ])("%s", (_name, element) => {
    const html = renderToStaticMarkup(element);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|style=|fill="|stroke="/);
    expect(EMOJI.test(html)).toBe(false);
  });
});
