import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { momentSteps, REVEAL_BUDGET_MS } from "@/lib/graveyard/resurrect-timing";
import { ResurrectStage } from "./ResurrectArea";

const stage = (parted: boolean, reduce: boolean) =>
  renderToStaticMarkup(<ResurrectStage parted={parted} loading={false} reduce={reduce} />);
const opacityOf = (html: string, className: string) => {
  const tag = new RegExp(`<[^>]*class="[^"]*${className}[^"]*"[^>]*>`).exec(html)?.[0] ?? "";
  const value = /opacity:\s*([\d.]+)/.exec(tag)?.[1];
  return value === undefined ? null : Number(value);
};

describe("the resurrection moment: what runs", () => {
  it("plays each step once, and the longest delay plus duration is under 2 seconds", () => {
    const steps = momentSteps(false);
    expect(steps.map((s) => s.name)).toEqual(["candle", "fog", "glow"]);
    for (const step of steps) expect(step.iterations).toBe(1);
    const end = Math.max(...steps.map((s) => s.delayMs + s.durationMs));
    expect(end).toBe(1400);
    expect(end).toBeLessThan(REVEAL_BUDGET_MS);
  });

  it("has no delay and no duration under reduced motion", () => {
    for (const step of momentSteps(true)) {
      expect(step.delayMs).toBe(0);
      expect(step.durationMs).toBe(0);
      expect(step.iterations).toBe(1);
    }
  });
});

describe("the stage end state", () => {
  it("before the plan: candle unlit, fog in place, no glow", () => {
    const html = stage(false, false);
    expect(opacityOf(html, "resurrect-stone-lit")).toBe(0);
    expect(opacityOf(html, "resurrect-fog-left")).toBe(1);
    expect(opacityOf(html, "resurrect-glow")).toBe(0);
  });

  it("with the plan: candle lit, fog cleared, glow settled", () => {
    for (const reduce of [false, true]) {
      const html = stage(true, reduce);
      expect(opacityOf(html, "resurrect-stone-lit")).toBe(1);
      expect(opacityOf(html, "resurrect-fog-left")).toBe(0);
      expect(opacityOf(html, "resurrect-fog-right")).toBe(0);
    }
  });

  it("under reduced motion the glow is already at its calm level, with no swell", () => {
    expect(opacityOf(stage(true, true), "resurrect-glow")).toBe(0.6);
  });

  it("is decorative: hidden from screen readers and nothing in it is focusable", () => {
    const html = stage(true, false);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<(a|button|input|select|textarea)\b|tabindex/);
  });
});
