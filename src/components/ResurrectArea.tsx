"use client";

import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { useEffect, useReducer, useRef } from "react";
import {
  EFFORT_LABEL,
  initialResurrectState,
  resurrectReducer,
  type RevivalPlanData,
} from "@/lib/graveyard/resurrect-state";
import { RESURRECT_TIMING } from "@/lib/graveyard/resurrect-timing";
import "./ResurrectArea.css";

export interface ResurrectAreaProps {
  repoName: string;
  /** Fetches the revival plan from the server route. Rejects when it cannot. */
  onResurrect: () => Promise<RevivalPlanData>;
}

const ms = (value: number) => value / 1000;

/**
 * Resurrect button, the fog-parting stage and the revival plan.
 * Success: fog parts (700ms), the stone glows (from 300ms), then the plan fades in
 * (from 900ms). Everything ends 1400ms after the plan arrives.
 * Loading and error states use the same voice: the repo is paused, not failed.
 */
export function ResurrectArea({ repoName, onResurrect }: ResurrectAreaProps) {
  const reduce = useReducedMotion() === true;
  const [state, dispatch] = useReducer(resurrectReducer, initialResurrectState);
  const mounted = useRef(true);
  const errorHeading = useRef<HTMLHeadingElement>(null);
  const planHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The button unmounts on success and the error heading takes focus on failure, so
  // keyboard focus is always handed to something meaningful, never dropped to <body>.
  useEffect(() => {
    if (state.phase === "error") errorHeading.current?.focus();
    if (state.phase === "success")
      planHeading.current?.focus({ preventScroll: true });
  }, [state.phase]);

  const start = async () => {
    if (state.phase === "loading" || state.phase === "success") return;
    dispatch({ type: "start" });
    try {
      const plan = await onResurrect();
      if (mounted.current) dispatch({ type: "succeed", plan });
    } catch {
      if (mounted.current) dispatch({ type: "fail" });
    }
  };

  const t = RESURRECT_TIMING;
  const parted = state.phase === "success";
  const loading = state.phase === "loading";
  const fadeOnly = { duration: ms(t.reducedMs), ease: "easeOut" } as const;

  const fogTransition = reduce
    ? fadeOnly
    : { duration: ms(parted ? t.fogPartMs : 400), ease: "easeOut" as const };
  const glowTransition = reduce
    ? fadeOnly
    : {
        delay: parted ? ms(t.glowDelayMs) : 0,
        duration: ms(t.glowMs),
        ease: "easeOut" as const,
      };

  return (
    <MotionConfig reducedMotion="user">
      <section className="resurrect" aria-label={`Resurrect ${repoName}`}>
        <div className="resurrect-stage" aria-hidden="true">
          <svg className="resurrect-stone" viewBox="0 0 80 100">
            <path
              className="resurrect-stone-body"
              d="M8 100V40C8 18 22 6 40 6s32 12 32 34v60Z"
            />
            <motion.path
              className="resurrect-stone-lit"
              d="M8 100V40C8 18 22 6 40 6s32 12 32 34v60Z"
              initial={false}
              animate={{ opacity: parted ? 1 : 0 }}
              transition={glowTransition}
            />
          </svg>
          <motion.div
            className="resurrect-glow"
            initial={false}
            animate={{ opacity: parted ? 1 : 0, scale: parted ? 1 : 0.6 }}
            transition={glowTransition}
          />
          <motion.div
            className="resurrect-fog resurrect-fog-left"
            initial={false}
            animate={{ x: parted ? "-100%" : "0%", opacity: parted ? 0 : 1 }}
            transition={fogTransition}
          >
            <motion.div
              className="resurrect-fog-body"
              animate={{ opacity: loading && !reduce ? [0.7, 1, 0.7] : 1 }}
              transition={
                loading && !reduce
                  ? { duration: 3.6, ease: "easeInOut", repeat: Infinity }
                  : { duration: 0 }
              }
            />
          </motion.div>
          <motion.div
            className="resurrect-fog resurrect-fog-right"
            initial={false}
            animate={{ x: parted ? "100%" : "0%", opacity: parted ? 0 : 1 }}
            transition={fogTransition}
          >
            <motion.div
              className="resurrect-fog-body"
              animate={{ opacity: loading && !reduce ? [1, 0.7, 1] : 1 }}
              transition={
                loading && !reduce
                  ? { duration: 3.6, ease: "easeInOut", repeat: Infinity }
                  : { duration: 0 }
              }
            />
          </motion.div>
        </div>

        {state.phase !== "success" ? (
          // One persistent button for idle, loading and error, so keyboard focus stays on it
          // while the request runs. aria-disabled (not disabled) keeps it focusable.
          <button
            type="button"
            className="resurrect-button"
            aria-disabled={loading ? "true" : undefined}
            onClick={start}
          >
            {loading
              ? "Resurrecting…"
              : state.phase === "error"
                ? "Try again"
                : "Resurrect"}
          </button>
        ) : null}

        {loading ? (
          <p className="resurrect-note" role="status">
            <svg
              className="resurrect-icon"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6" />
            </svg>
            The fog is gathering. Reading the signs of {repoName}…
          </p>
        ) : null}

        {state.phase === "error" ? (
          <div className="resurrect-error" role="alert">
            <h3
              className="resurrect-error-title"
              tabIndex={-1}
              ref={errorHeading}
            >
              <svg
                className="resurrect-icon"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path d="M8 1 15 14H1Z" />
              </svg>
              The spirits stayed quiet
            </h3>
            <p className="resurrect-error-text">
              The revival did not go through this time. {repoName} is only
              paused, not gone. Give it a moment and try again.
            </p>
          </div>
        ) : null}

        {state.phase === "success" ? (
          <>
            <p className="resurrect-sr-only" role="status">
              Revival plan ready for {repoName}.
            </p>
            <motion.div
              className="resurrect-plan"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce
                  ? fadeOnly
                  : {
                      delay: ms(t.planDelayMs),
                      duration: ms(t.planMs),
                      ease: "easeOut",
                    }
              }
            >
              <h3
                className="resurrect-plan-title"
                tabIndex={-1}
                ref={planHeading}
              >
                Revival plan
              </h3>
              <dl className="resurrect-plan-list">
                <dt>Diagnosis</dt>
                <dd>{state.plan.diagnosis}</dd>
                <dt>Smallest next step</dt>
                <dd>{state.plan.smallestNextStep}</dd>
                <dt>Effort</dt>
                <dd>{EFFORT_LABEL[state.plan.effort]}</dd>
              </dl>
            </motion.div>
          </>
        ) : null}
      </section>
    </MotionConfig>
  );
}
