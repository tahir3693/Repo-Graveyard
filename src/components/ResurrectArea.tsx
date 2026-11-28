"use client";

import { MotionConfig, motion, useReducedMotion } from "framer-motion";
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
import { RESURRECT_TIMING } from "@/lib/graveyard/resurrect-timing";
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
      if (mounted.current) dispatch({ type: "succeed", plan });
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
              Revival plan ready for {repoName}.
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