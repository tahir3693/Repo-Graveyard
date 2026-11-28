import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode, Ref } from "react";
import { parseIssueBody } from "@/lib/graveyard/issue-body";
import type { RevivalPlanData } from "@/lib/graveyard/resurrect-state";
import { planItemDelayMs, RESURRECT_TIMING } from "@/lib/graveyard/resurrect-timing";
import type { Decision, EffortLevel } from "@/lib/resurrection/plan";
import {
  CautionIcon,
  CheckIcon,
  ClockIcon,
  LevelIcon,
  TaskBoxIcon,
  VerdictIcon,
} from "./PlanIcons";
import "./ResurrectPlan.css";

export type IssueState =
  | { phase: "idle" }
  | { phase: "pending" }
  | { phase: "filed"; url: string | null }
  | { phase: "error"; text: string };

export type CopyState = "idle" | "copied" | "failed";

export const FALLBACK_PLAN_NOTE = "Rule-based plan (the AI was unavailable)";
export const AI_PLAN_NOTE = "Written by AI";
export const DEMO_ISSUE_NOTE = "Filing issues is turned off in the demo.";
export const FILING_MESSAGE = "Filing\u2026";
export const FILED_MESSAGE = "Issue filed. This repo has a pulse again.";
export const COPIED_MESSAGE = "Issue copied to clipboard.";
export const COPY_FAILED_MESSAGE = "Could not copy. Select the text and copy it by hand.";
export const LABELS_NOTE = "Labels are not added when filing. Add them by hand if you want them.";

export const VERDICT_LABEL: Record<Decision, string> = {
  revive: "Revive",
  archive: "Archive",
  merge: "Merge",
};

export const EFFORT_LEVEL_LABEL: Record<EffortLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** One live message for the issue actions: filing wins, then the copy result. */
export function issueStatusMessage(issue: IssueState, copy: CopyState): string | null {
  if (issue.phase === "pending") return FILING_MESSAGE;
  if (issue.phase === "filed") return FILED_MESSAGE;
  if (copy === "copied") return COPIED_MESSAGE;
  if (copy === "failed") return COPY_FAILED_MESSAGE;
  return null;
}

/**
 * One plan section. The sections fade in about 60ms apart once the fog has parted.
 * Under reduced motion there is no animation at all: the section is simply there.
 */
function Reveal({
  as,
  index,
  className,
  labelledBy,
  children,
}: {
  as: "section" | "div";
  index: number;
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion() === true;
  const Tag = as === "section" ? motion.section : motion.div;
  return (
    <Tag
      className={className}
      aria-labelledby={labelledBy}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: planItemDelayMs(index) / 1000,
        duration: RESURRECT_TIMING.sectionMs / 1000,
        ease: "easeOut",
      }}
    >
      {children}
    </Tag>
  );
}

function Card({
  id,
  title,
  index,
  className,
  children,
}: {
  id: string;
  title: string;
  index: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Reveal as="section" index={index} labelledBy={id} className={`resurrect-block${className ? ` ${className}` : ""}`}>
      <h4 id={id} className="resurrect-block-title">
        {title}
      </h4>
      {children}
    </Reveal>
  );
}

export interface ResurrectPlanProps {
  plan: RevivalPlanData;
  /** Demo graveyards are look-only: Filing is shown disabled with an explanation. */
  demo: boolean;
  issue: IssueState;
  copy: CopyState;
  /** Unique prefix for element ids, so two plans on one page never clash. */
  idPrefix: string;
  headingRef?: Ref<HTMLHeadingElement>;
  onCopy: () => void;
  onFile: () => void;
}

function IssueBody({ body }: { body: string }) {
  return (
    <div
      className="resurrect-issue-body"
      role="region"
      aria-label="Issue body, read-only preview"
      tabIndex={0}
    >
      {parseIssueBody(body).map((block, i) =>
        block.kind === "text" ? (
          <p key={i} className="plan-issue-text">
            {block.text}
          </p>
        ) : (
          <ul key={i} className="plan-tasks">
            {block.items.map((item, j) => (
              <li key={j} className="plan-task">
                <TaskBoxIcon done={item.done} />
                <span className="plan-task-text">
                  {item.done ? <span className="resurrect-sr-only">Done: </span> : null}
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

/**
 * The revival plan, top to bottom: verdict, diagnosis, roadmap, quick wins and risks,
 * effort, drafted issue and the source line. Heading levels: h3 plan, h4 sections, h5
 * items inside a section.
 */
export function ResurrectPlan({
  plan,
  demo,
  issue,
  copy,
  idPrefix,
  headingRef,
  onCopy,
  onFile,
}: ResurrectPlanProps) {
  const { detail } = plan;
  const demoNoteId = `${idPrefix}-demo-note`;
  const message = issueStatusMessage(issue, copy);
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <>
      <Reveal as="div" index={0}>
        <h3 className="resurrect-plan-title" tabIndex={-1} ref={headingRef}>
          Revival plan
        </h3>
      </Reveal>

      <Reveal
        as="section"
        index={1}
        labelledBy={id("verdict")}
        className={`plan-verdict plan-verdict-${detail.verdict.decision}`}
      >
        <h4 id={id("verdict")} className="plan-verdict-heading">
          Verdict
        </h4>
        <p className="plan-badge">
          <VerdictIcon decision={detail.verdict.decision} />
          {VERDICT_LABEL[detail.verdict.decision]}
        </p>
        <p className="plan-verdict-reason">{detail.verdict.reason}</p>
      </Reveal>

      <Card id={id("diagnosis")} title="Diagnosis" index={2}>
        <p className="resurrect-block-text">{detail.diagnosis}</p>
      </Card>

      <Card id={id("roadmap")} title="Revival roadmap" index={3}>
        <ol className="plan-steps" role="list">
          {detail.roadmap.map((step, i) => (
            <li key={i} className="plan-step">
              <span className="plan-step-num" aria-hidden="true">
                {i + 1}
              </span>
              <div className="plan-step-main">
                <div className="plan-step-head">
                  <h5 className="plan-step-title">{step.title}</h5>
                  {i === 0 ? <span className="plan-start">Start here</span> : null}
                </div>
                <p className="resurrect-block-text">{step.action}</p>
                <p className="plan-step-meta">
                  <span className="plan-chip">
                    <ClockIcon />
                    <span className="resurrect-sr-only">Effort: </span>
                    {step.effort}
                  </span>
                </p>
                <p className="plan-why">
                  <span className="plan-why-label">Why:</span> {step.why}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="plan-columns">
        <Card id={id("wins")} title="Quick wins" index={4}>
          <ul className="plan-list" role="list">
            {detail.quickWins.map((win, i) => (
              <li key={i} className="plan-list-item">
                <CheckIcon />
                <span className="plan-list-text">{win}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card id={id("risks")} title="Risks" index={5}>
          <ul className="plan-list" role="list">
            {detail.risks.map((risk, i) => (
              <li key={i} className="plan-list-item">
                <CautionIcon />
                <span className="plan-list-text">
                  <span className="resurrect-sr-only">Caution: </span>
                  {risk}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card id={id("effort")} title="Effort" index={6} className="plan-effort">
        <p className="plan-effort-line">
          <LevelIcon level={detail.effort.level} />
          <span>
            <strong>{EFFORT_LEVEL_LABEL[detail.effort.level]}</strong>
            {", "}
            {detail.effort.total}
          </span>
        </p>
      </Card>

      <Card id={id("issue")} title="Drafted issue" index={7}>
        <h5 className="resurrect-issue-heading">Issue title</h5>
        <p className="resurrect-issue-title">{detail.issue.title}</p>
        <h5 className="resurrect-issue-heading">Issue body</h5>
        <IssueBody body={detail.issue.body} />

        {detail.issue.labels.length > 0 ? (
          <>
            <h5 className="resurrect-issue-heading">Suggested labels</h5>
            <ul className="plan-labels" role="list">
              {detail.issue.labels.map((label, i) => (
                <li key={i} className="plan-chip">
                  {label}
                </li>
              ))}
            </ul>
            <p className="resurrect-note">{LABELS_NOTE}</p>
          </>
        ) : null}

        {issue.phase === "filed" ? (
          issue.url !== null ? (
            <p className="resurrect-issue-done">
              <a
                className="resurrect-issue-link"
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View the issue on GitHub
              </a>
            </p>
          ) : null
        ) : (
          <div className="resurrect-actions">
            <button type="button" className="resurrect-button" onClick={onCopy}>
              {copy === "copied" ? (
                <>
                  <span aria-hidden="true">{"\u2713"} </span>Copied
                </>
              ) : (
                "Copy issue"
              )}
            </button>
            <button
              type="button"
              className="resurrect-button resurrect-button-primary"
              aria-disabled={demo || issue.phase === "pending" ? "true" : undefined}
              aria-describedby={demo ? demoNoteId : undefined}
              onClick={onFile}
            >
              File this issue
            </button>
          </div>
        )}

        {issue.phase !== "filed" && demo ? (
          <p id={demoNoteId} className="resurrect-note">
            {DEMO_ISSUE_NOTE}
          </p>
        ) : null}

        {/* Always rendered, so a screen reader hears the change when the text appears. */}
        <p className="resurrect-note" role="status" aria-live="polite">
          {message}
        </p>
        {issue.phase === "error" ? (
          <p className="resurrect-issue-error" role="alert">
            {issue.text}
          </p>
        ) : null}
      </Card>

      <Reveal as="div" index={8}>
        <p className="plan-source">{plan.fallback === true ? FALLBACK_PLAN_NOTE : AI_PLAN_NOTE}</p>
      </Reveal>
    </>
  );
}
