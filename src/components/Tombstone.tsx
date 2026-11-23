"use client";

import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { stoneAriaLabel, type FogStep, type StoneVocab } from "@/lib/graveyard/stone-vocab";
import "./Tombstone.css";

export type TombstoneStatus = "alive" | "dying" | "dead" | "ancient";

export interface TombstoneProps {
  name: string;
  /** Cause of death label, for example "Quietly retired". Part of the accessible name. */
  cause: string;
  epitaph: string;
  status: TombstoneStatus;
  /** Lit candle: the repo had recent activity. */
  candle: boolean;
  /**
   * Visual vocabulary from `buildStoneVocab`: size, fog, cracks and vines. When given, the
   * accessible name also says each trait in words. Without it the stone is plain.
   */
  vocab?: StoneVocab;
  onSelect?: () => void;
}

export const STATUS_LABEL: Record<TombstoneStatus, string> = {
  alive: "Alive",
  dying: "Dying",
  dead: "Dead",
  ancient: "Ancient",
};

/** One distinct shape per status, so status never relies on color alone. */
export function StatusIcon({ status }: { status: TombstoneStatus }) {
  return (
    <svg
      className="tombstone-status-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      {status === "alive" && <circle cx="8" cy="8" r="6" />}
      {status === "dying" && <path d="M8 2 15 14H1Z" />}
      {status === "dead" && <rect x="2" y="2" width="12" height="12" />}
      {status === "ancient" && <path d="M8 1 15 8 8 15 1 8Z" />}
    </svg>
  );
}

const FLICKER_OPACITY = [0.55, 1, 0.7, 0.95, 0.55];
const FLICKER_SCALE = [1, 1.06, 0.98, 1.04, 1];

/**
 * Candle glow. The loop period is 2.4s with a change of direction every 0.6s,
 * so it never flickers faster than 3 times per second.
 */
function CandleGlow({ still }: { still: boolean }) {
  return (
    <span className="tombstone-candle" aria-hidden="true">
      <motion.span
        className="tombstone-glow"
        initial={{ opacity: 0.9, scale: 1 }}
        animate={
          still
            ? { opacity: 0.9, scale: 1 }
            : { opacity: FLICKER_OPACITY, scale: FLICKER_SCALE }
        }
        transition={
          still
            ? { duration: 0 }
            : {
                duration: 2.4,
                ease: "easeInOut",
                repeat: Infinity,
                times: [0, 0.25, 0.5, 0.75, 1],
              }
        }
      />
      <svg className="tombstone-candle-svg" viewBox="0 0 24 48">
        <rect
          className="tombstone-wax"
          x="7"
          y="24"
          width="10"
          height="24"
          rx="1"
        />
        <line
          className="tombstone-wick"
          x1="12"
          y1="24"
          x2="12"
          y2="20"
          strokeWidth="1.5"
        />
        <path
          className="tombstone-flame"
          d="M12 4C16 10 17 15 12 20 7 15 8 10 12 4Z"
        />
      </svg>
    </span>
  );
}

/** Fog around the base. Decorative: the same fact is in the accessible name. */
function FogBand({ step }: { step: Exclude<FogStep, "none"> }) {
  return <span className="tombstone-fog" data-step={step} />;
}

/** A crack in the stone, drawn in the right gutter so it never crosses the text. */
function Cracks() {
  return (
    <svg
      className="tombstone-cracks"
      viewBox="0 0 16 80"
      preserveAspectRatio="none"
    >
      <path d="M12 0 L6 14 L11 26 L4 40 L9 52 L5 66 L8 80" />
      <path d="M6 14 L1 18 M11 26 L15 31 M4 40 L1 46" />
    </svg>
  );
}

/** Two vines growing up from the base, in the side gutters. */
function Vines() {
  return (
    <>
      {(["left", "right"] as const).map((side) => (
        <svg
          key={side}
          className={`tombstone-vine tombstone-vine-${side}`}
          viewBox="0 0 16 80"
          preserveAspectRatio="none"
        >
          <path
            className="tombstone-vine-stem"
            d="M8 80 C2 66 14 56 8 44 C3 34 12 24 8 8"
          />
          <path
            className="tombstone-vine-leaf"
            d="M8 62 Q1 60 1 53 Q8 54 8 62Z M8 46 Q15 44 15 37 Q8 38 8 46Z M8 28 Q2 26 2 20 Q8 21 8 28Z"
          />
        </svg>
      ))}
    </>
  );
}

export function Tombstone({
  name,
  cause,
  epitaph,
  status,
  candle,
  vocab,
  onSelect,
}: TombstoneProps) {
  const reduce = useReducedMotion() === true;
  const epitaphId = useId();
  const statusClass =
    status === "alive" ? "tombstone-status-alive" : "tombstone-status-failing";

  return (
    <MotionConfig reducedMotion="user">
      <motion.button
        type="button"
        className="tombstone"
        aria-label={
          vocab === undefined
            ? `${name}, ${STATUS_LABEL[status]}, ${cause}`
            : stoneAriaLabel({
                name,
                statusLabel: STATUS_LABEL[status],
                cause,
                vocab: { ...vocab, candle },
              })
        }
        data-size={vocab?.size}
        data-fog={vocab?.fog}
        aria-describedby={epitaphId}
        onClick={onSelect}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: reduce ? 0.15 : 0.4, ease: "easeOut" }}
        whileHover={
          reduce
            ? undefined
            : { y: -4, transition: { duration: 0.2, ease: "easeOut" } }
        }
      >
        <span className="tombstone-ring" aria-hidden="true" />
        {vocab !== undefined &&
        (vocab.fog !== "none" || vocab.cracks || vocab.vines) ? (
          <span className="tombstone-decor" aria-hidden="true">
            {vocab.fog !== "none" ? <FogBand step={vocab.fog} /> : null}
            {vocab.cracks ? <Cracks /> : null}
            {vocab.vines ? <Vines /> : null}
          </span>
        ) : null}
        <span className="tombstone-name">{name}</span>
        <span className={`tombstone-status ${statusClass}`}>
          <StatusIcon status={status} />
          {STATUS_LABEL[status]}
        </span>
        <span className="tombstone-cause">{cause}</span>
        <span className="tombstone-epitaph" id={epitaphId}>
          {epitaph}
        </span>
        {candle ? <CandleGlow still={reduce} /> : null}
      </motion.button>
    </MotionConfig>
  );
}
