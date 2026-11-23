"use client";

import { useEffect, useRef } from "react";

/** One entry per visual trait. Each pairs the drawing with what it means, in words. */
export const LEGEND_ITEMS = [
  { trait: "Stone size", meaning: "stars" },
  { trait: "Fog", meaning: "silence" },
  { trait: "Cracks", meaning: "failing CI" },
  { trait: "Vines", meaning: "old dependencies" },
  { trait: "Candle", meaning: "recent activity" },
] as const;

const SMALL_SCREEN = "(max-width: 767px)";

/**
 * Short key to the stones. Open on wide screens and collapsed on phones, where the reader can
 * open it with the keyboard or a tap. Without JavaScript it stays open, so the key is never lost.
 */
export function GraveyardLegend() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (window.matchMedia(SMALL_SCREEN).matches && ref.current) ref.current.open = false;
  }, []);
  return (
    <details className="graveyard-legend" ref={ref} open>
      <summary className="graveyard-legend-summary">What the stones show</summary>
      <ul className="graveyard-legend-list">
        {LEGEND_ITEMS.map((item) => (
          <li key={item.trait} className="graveyard-legend-item">
            <strong>{item.trait}</strong>: {item.meaning}.
          </li>
        ))}
      </ul>
    </details>
  );
}
