"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { moonBrightness } from "@/lib/graveyard/moon";
import "./GraveyardScene.css";

export interface GraveyardSceneProps {
  /** Repos with status alive. Drives the moon and sky brightness. */
  alive: number;
  /** All repos in the scene. */
  total: number;
  children?: ReactNode;
}

/**
 * Graveyard backdrop in pure SVG and CSS: sky, moon, three fog layers and ground.
 * Moon and sky brightness = share of alive repos (see design-system.md, visual vocabulary).
 * Pointer parallax moves decorative layers only, never the stones, and is off for
 * prefers-reduced-motion.
 */
export function GraveyardScene({ alive, total, children }: GraveyardSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const brightness = moonBrightness(alive, total);
  const safeAlive = Number.isFinite(alive) ? Math.max(0, Math.floor(alive)) : 0;
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const reset = () => {
      el.style.setProperty("--scene-px", "0");
      el.style.setProperty("--scene-py", "0");
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) return;
        const x = ((event.clientX - box.left) / box.width) * 2 - 1;
        const y = ((event.clientY - box.top) / box.height) * 2 - 1;
        el.style.setProperty("--scene-px", String(Math.max(-1, Math.min(1, x))));
        el.style.setProperty("--scene-py", String(Math.max(-1, Math.min(1, y))));
      });
    };

    const attach = () => {
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerleave", reset);
    };
    const detach = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
      cancelAnimationFrame(frame);
      reset();
    };
    const sync = () => (query.matches ? detach() : attach());

    sync();
    query.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
      detach();
    };
  }, []);

  return (
    <div
      ref={sceneRef}
      className="scene"
      style={{ "--scene-brightness": brightness } as React.CSSProperties}
    >
      <p className="sr-only">
        {safeAlive} of {safeTotal} repos alive. The moon is brighter when more repos are
        alive.
      </p>

      <div className="scene-sky" aria-hidden="true" />

      <div className="scene-layer scene-layer-moon" aria-hidden="true">
        <div className="scene-moon-halo" />
        <svg className="scene-moon" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" />
        </svg>
      </div>

      <div className="scene-layer scene-layer-fog-back" aria-hidden="true">
        <div className="scene-fog scene-fog-slow" />
      </div>
      <div className="scene-layer scene-layer-fog-mid" aria-hidden="true">
        <div className="scene-fog scene-fog-medium" />
      </div>

      <svg
        className="scene-ground"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0 60 C200 20 380 90 600 55 C820 20 1000 85 1200 45 V120 H0 Z" />
      </svg>

      <div className="scene-content">{children}</div>

      <div className="scene-layer scene-layer-fog-front" aria-hidden="true">
        <div className="scene-fog scene-fog-fast" />
      </div>
    </div>
  );
}