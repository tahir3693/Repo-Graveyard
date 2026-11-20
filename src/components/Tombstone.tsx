"use client";

import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
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
  onSelect?: () => void;
}

const STATUS_LABEL: Record<TombstoneStatus, string> = {
  alive: "Alive",
  dying: "Dying",
  dead: "Dead",
  ancient: "Ancient",
};

/** One distinct shape per status, so status never relies on color alone. */
function StatusIcon({ status }: { status: TombstoneStatus }) {
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

export function Tombstone({
  name,
  cause,
  epitaph,
  status,
  candle,
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
        aria-label={`${name}, ${STATUS_LABEL[status]}, ${cause}`}
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
