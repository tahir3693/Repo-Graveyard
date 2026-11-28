"use client";

import { MotionConfig, motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import { useEffect, useId, useReducer, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/graveyard/clipboard";
import type { FileIssueResult, IssueErrorCode } from "@/lib/graveyard/client";
import { buildIssueText } from "@/lib/graveyard/issue-text";
import { safeIssueLink } from "@/lib/graveyard/issue-link";
import {
  initialResurrectState,
  resurrectReducer,
  type RevivalPlanData,
} from "@/lib/graveyard/resurrect-state";
import { FLAME_BREATH_SECONDS, momentSteps } from "@/lib/graveyard/resurrect-timing";
import { ResurrectPlan, type CopyState, type IssueState } from "./ResurrectPlan";
import "./ResurrectArea.css";

export interface ResurrectAreaProps {
  repoName: string;
  /** Fetches the revival plan from the server route. Rejects when it cannot. */
  onResurrect: () => Promise<RevivalPlanData>;
  /** Demo graveyards are look-only: the "File this issue" button does nothing. */
  demo: boolean;
  /** Files the plan's issue through the server route. Resolves to a safe result, never throws. */
  onFileIssue: (issue: { title: string; body: string }) => Promise<FileIssueResult>;
  /** Called once when the plan arrives, so the drawer badge can change to "Reviving". */
  onRevived?: () => void;
}

const ISSUE_GENERIC =
  "GitHub would not take the issue. Check the repo's issue list before trying again.";
const ISSUE_CHECK_LIST =
  "GitHub did not answer. The issue may not have been created. Check the repository's issue list before trying again.";

/** Fixed, kind copy per error code. Never shows response text or the code itself. */
export function issueErrorText(code: IssueErrorCode, retryAfterSeconds?: number): string {
  switch (code) {
    case "unauthenticated":
      return "The graveyard gate is locked. Sign in with GitHub to file this issue.";
    case "token_revoked":
      return "GitHub closed the door on our key. Sign in again to reopen the graveyard.";
    case "not_repo_owner":
      return "Only the repo's keeper can file issues here.";
    case "repo_archived":
      return "Archived repos are read-only. Unarchive it first, and it can be resurrected.";
    case "issues_disabled":
      return "This repo has issues switched off. Turn them on in the repo settings, then try again.";
    case "issue_rate_limited":
      return retryAfterSeconds === undefined
        ? "The keeper needs a breather. Try again shortly."
        : `The keeper needs a breather. Try again in ${retryAfterSeconds} seconds.`;
    case "rate_limited":
      return "GitHub needs a moment to rest. Try again soon.";
    case "issue_result_unknown":
    case "github_unavailable":
      return ISSUE_CHECK_LIST;
    default:
      return ISSUE_GENERIC;
  }
}

const ms = (value: number) => value / 1000;

/** The stage: a stone with a candle under two fog panels. Decorative and never focusable. */
export function ResurrectStage({ parted, loading, reduce }: { parted: boolean; loading: boolean; reduce: boolean }) {
  /*
   * The resurrection moment, on the stone in the drawer. It plays once, when the plan
   * arrives, and never takes focus or blocks the plan (which starts to appear at 200ms):
   *   the candle lights (0ms), the fog clears (250ms), one violet glow swells and settles
   *   (500ms). The badge change lives in GraveDrawer. Under reduced motion every part
   *   jumps straight to its final state.
   */
  const instant = { duration: 0 } as const;
  const [candle, fog, glow] = momentSteps(reduce);
  const transitionOf = (step: { delayMs: number; durationMs: number }) =>
    reduce ? instant : { delay: ms(step.delayMs), duration: ms(step.durationMs), ease: "easeOut" as const };
  const candleTransition = transitionOf(candle);
  const fogTransition = transitionOf(fog);
  const litTransition = transitionOf(glow);
  // One swell (up, then down to a calm level) instead of a loop.
  const glowAnimate: TargetAndTransition = reduce
    ? { opacity: parted ? 0.6 : 0, scale: 1 }
    : {
        opacity: parted ? [0, 1, 0.6] : 0,
        scale: parted ? [0.6, 1.15, 1] : 0.6,
      };
  const glowTransition = reduce ? instant : { ...litTransition, times: [0, 0.45, 1] };
  // After it lights, the flame breathes slowly: a 2.4s period, never faster than 3 per second.
  const flicker = parted && !reduce;

  return (
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
          transition={litTransition}
        />
        <rect className="resurrect-wax" x="35" y="72" width="10" height="24" rx="1" />
        <line className="resurrect-wick" x1="40" y1="72" x2="40" y2="67" strokeWidth="1.5" />
        <motion.g
          initial={false}
          animate={{ opacity: parted ? 1 : 0, scale: parted ? 1 : 0.2 }}
          transition={candleTransition}
          style={{ originX: 0.5, originY: 1 }}
        >
          <motion.path
            className="resurrect-flame"
            d="M40 52C44.5 58 45.5 63 40 67.5 34.5 63 35.5 58 40 52Z"
            initial={false}
            animate={flicker ? { scaleY: [1, 1.08, 0.96, 1.05, 1] } : { scaleY: 1 }}
            transition={
              flicker
                ? {
                    delay: ms(candle.delayMs + candle.durationMs),
                    duration: FLAME_BREATH_SECONDS,
                    ease: "easeInOut",
                    repeat: Infinity,
                    times: [0, 0.25, 0.5, 0.75, 1],
                  }
                : instant
            }
            style={{ originX: 0.5, originY: 1 }}
          />
        </motion.g>
      </svg>
      <motion.div
        className="resurrect-glow"
        initial={false}
        animate={glowAnimate}
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
  );
}

/**
 * Resurrect button, the fog-parting stage and the revival plan.
 * Success: fog parts (700ms), the stone glows (from 300ms), then the plan fades in
 * (from 900ms). Everything ends 1400ms after the plan arrives.
 * Loading and error states use the same voice: the repo is paused, not failed.
 */
export function ResurrectArea({
  repoName,
  onResurrect,
  demo,
  onFileIssue,
  onRevived,
}: ResurrectAreaProps) {
  const reduce = useReducedMotion() === true;
  const [state, dispatch] = useReducer(resurrectReducer, initialResurrectState);
  const mounted = useRef(true);
  const errorHeading = useRef<HTMLHeadingElement>(null);
  const planHeading = useRef<HTMLHeadingElement>(null);
  const [issue, setIssue] = useState<IssueState>({ phase: "idle" });
  const filing = useRef(false);
  const idPrefix = useId();
  const [copy, setCopy] = useState<CopyState>("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
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
      if (mounted.current) {
        dispatch({ type: "succeed", plan });
        onRevived?.();
      }
    } catch {
      if (mounted.current) dispatch({ type: "fail" });
    }
  };

  const copyIssue = async (plan: RevivalPlanData) => {
    const ok = await copyToClipboard(buildIssueText(plan.issueTitle, plan.issueBody));
    if (!mounted.current) return;
    setCopy(ok ? "copied" : "failed");
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    // The "Copied" label is a confirmation, so it goes back to "Copy issue" after a moment.
    copyTimer.current = setTimeout(() => {
      if (mounted.current) setCopy("idle");
    }, 2500);
  };

  const fileIssueNow = async (plan: RevivalPlanData) => {
    // Demo is look-only: no request, no state change. Pending ignores repeat activations.
    if (demo || filing.current) return;
    filing.current = true;
    setIssue({ phase: "pending" });
    let result: FileIssueResult;
    try {
      result = await onFileIssue({ title: plan.issueTitle, body: plan.issueBody });
    } catch {
      result = { ok: false, code: "generic" };
    }
    filing.current = false;
    if (!mounted.current) return;
    setIssue(
      result.ok
        ? { phase: "filed", url: safeIssueLink(result.issueUrl) }
        : { phase: "error", text: issueErrorText(result.code, result.retryAfterSeconds) },
    );
  };

  const parted = state.phase === "success";
  const loading = state.phase === "loading";

  return (
    <MotionConfig reducedMotion="user">
      <section className="resurrect" aria-label={`Resurrect ${repoName}`}>
        <ResurrectStage parted={parted} loading={loading} reduce={reduce} />
        {state.phase !== "success" ? (
          // One persistent button for idle, loading and error, so keyboard focus stays on it
          // while the request runs. aria-disabled (not disabled) keeps it focusable.
          <button
            type="button"
            className="btn btn-primary resurrect-button"
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

        {state.phase === "idle" ? (
          <p className="resurrect-note">
            Get a revival plan and a ready-to-file issue for {repoName}.
          </p>
        ) : null}

        {loading ? (
          <div className="resurrect-loading">
            {/* A steady, slow sweep: transform only, one pass every 2.4 seconds. */}
            <div className="resurrect-progress" aria-hidden="true">
              <span className="resurrect-progress-bar" />
            </div>
            <p className="resurrect-note" role="status">
              The fog is gathering. Reading the signs of {repoName}…
            </p>
          </div>
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
              Revival plan ready for {repoName}. Status: reviving.
            </p>
            {/* Each plan section reveals itself, about 60ms apart (see ResurrectPlan). */}
            <div className="resurrect-plan">
              <ResurrectPlan
                plan={state.plan}
                demo={demo}
                issue={issue}
                copy={copy}
                idPrefix={idPrefix}
                headingRef={planHeading}
                onCopy={() => copyIssue(state.plan)}
                onFile={() => fileIssueNow(state.plan)}
              />
            </div>
          </>
        ) : null}
      </section>
    </MotionConfig>
  );
}