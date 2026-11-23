import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewToggle } from "./ViewToggle";

const NOOP = () => undefined;

function buttons(html: string): { label: string; pressed: string }[] {
  return [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>(.*?)<\/button>/g)].map((m) => ({
    pressed: m[1] ?? "",
    label: (m[2] ?? "").replace(/<[^>]+>/g, "").replace("\u2713", ""),
  }));
}

describe("ViewToggle", () => {
  it("renders two real buttons named Graveyard and List", () => {
    const html = renderToStaticMarkup(<ViewToggle view="graveyard" onChange={NOOP} />);
    expect(buttons(html).map((b) => b.label)).toEqual(["Graveyard", "List"]);
    expect(html.match(/<button type="button"/g)).toHaveLength(2);
    expect(html).toContain('role="group" aria-label="View"');
  });

  it("presses Graveyard by default and List when the view is list", () => {
    expect(buttons(renderToStaticMarkup(<ViewToggle view="graveyard" onChange={NOOP} />)).map((b) => b.pressed)).toEqual([
      "true",
      "false",
    ]);
    expect(buttons(renderToStaticMarkup(<ViewToggle view="list" onChange={NOOP} />)).map((b) => b.pressed)).toEqual([
      "false",
      "true",
    ]);
  });

  it("marks the pressed button with a check as well as aria-pressed", () => {
    const html = renderToStaticMarkup(<ViewToggle view="list" onChange={NOOP} />);
    expect(html.match(/graveyard-chip-check/g)).toHaveLength(1);
  });
});
