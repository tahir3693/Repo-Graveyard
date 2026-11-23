import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraveyardLegend, LEGEND_ITEMS } from "./GraveyardLegend";

describe("GraveyardLegend", () => {
  const html = renderToStaticMarkup(<GraveyardLegend />);
  const text = html.replace(/<[^>]+>/g, "");

  it("says the whole key in words", () => {
    expect(text).toContain(
      "Stone size: stars.Fog: silence.Cracks: failing CI.Vines: old dependencies.Candle: recent activity.",
    );
    expect(LEGEND_ITEMS).toHaveLength(5);
  });

  it("is a collapsible details element that is open without JavaScript", () => {
    expect(html).toMatch(/^<details class="graveyard-legend" open="">/);
    expect(html).toContain("<summary");
  });
});
