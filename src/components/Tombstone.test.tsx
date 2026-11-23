import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { StoneVocab } from "@/lib/graveyard/stone-vocab";
import { Tombstone } from "./Tombstone";

const NOOP = () => undefined;

function render(vocab: StoneVocab | undefined, candle = false): string {
  return renderToStaticMarkup(
    <Tombstone
      name="todo-app"
      cause="Quietly retired"
      epitaph="Here lies todo-app."
      status="dead"
      candle={candle}
      vocab={vocab}
      onSelect={NOOP}
    />,
  );
}

const FULL: StoneVocab = { size: "large", fog: "dense", cracks: true, vines: true, candle: false };

function labelOf(html: string): string {
  const match = /aria-label="([^"]*)"/.exec(html);
  return match?.[1] ?? "";
}

describe("Tombstone visual vocabulary", () => {
  it("says every trait in the accessible name", () => {
    expect(labelOf(render(FULL))).toBe(
      "todo-app, Dead, quietly retired, large stone, failing CI, outdated dependencies, dense fog",
    );
  });

  it("names the candle as recent activity from the candle prop", () => {
    expect(labelOf(render({ ...FULL, cracks: false, vines: false, fog: "none" }, true))).toBe(
      "todo-app, Dead, quietly retired, large stone, recent activity",
    );
  });

  it("renders the drawings as hidden decoration, and only for the traits that are on", () => {
    const html = render(FULL);
    expect(html).toContain('data-size="large"');
    expect(html).toContain('data-fog="dense"');
    expect(html).toContain("tombstone-fog");
    expect(html).toContain("tombstone-cracks");
    expect(html).toContain("tombstone-vine-left");
    expect(html).toMatch(/class="tombstone-decor" aria-hidden="true"/);

    const plain = render({ size: "small", fog: "none", cracks: false, vines: false, candle: false });
    expect(plain).not.toContain("tombstone-decor");
    expect(plain).not.toContain("tombstone-cracks");
    expect(plain).not.toContain("tombstone-vine");
    expect(plain).not.toContain("tombstone-fog");
  });

  it("keeps the plain label when no vocabulary is given", () => {
    expect(labelOf(render(undefined))).toBe("todo-app, Dead, Quietly retired");
  });

  it("is still one focusable button", () => {
    expect(render(FULL)).toMatch(/^<button type="button"/);
  });
});
