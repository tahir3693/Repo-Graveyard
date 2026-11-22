import type { ReactNode, Ref } from "react";
import { EFFORT_LABEL, type RevivalPlanData } from "@/lib/graveyard/resurrect-state";

export type IssueState =
  | { phase: "idle" }
  | { phase: "pending" }
  | { phase: "filed"; url: string | null }
  | { phase: "error"; text: string };

export type CopyState = "idle" | "copied" | "failed";

export const DEMO_ISSUE_NOTE = "Filing issues is turned off in the demo.";
export const FILING_MESSAGE = "Filing\u2026";
export const FILED_MESSAGE = "Issue filed. This repo has a pulse again.";
export const COPIED_MESSAGE = "Issue copied to clipboard.";
export const COPY_FAILED_MESSAGE = "Could not copy. Select the text and copy it by hand.";

/** One live message for the issue actions: filing wins, then the copy result. */
export function issueStatusMessage(issue: IssueState, copy: CopyState): string | null {
  if (issue.phase === "pending") return FILING_MESSAGE;
  if (issue.phase === "filed") return FILED_MESSAGE;
  if (copy === "copied") return COPIED_MESSAGE;
  if (copy === "failed") return COPY_FAILED_MESSAGE;
  return null;
}

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="resurrect-block" aria-labelledby={id}>
      <h4 id={id} className="resurrect-block-title">
        {title}
      </h4>
      {children}
    </section>
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

/** The revival plan as four separate blocks, plus the copy and file actions. */
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
  const demoNoteId = `${idPrefix}-demo-note`;
  const message = issueStatusMessage(issue, copy);
  return (
    <>
      <h3 className="resurrect-plan-title" tabIndex={-1} ref={headingRef}>
        Revival plan
      </h3>

      <Block id={`${idPrefix}-diagnosis`} title="Diagnosis">
        <p className="resurrect-block-text">{plan.diagnosis}</p>
      </Block>
      <Block id={`${idPrefix}-step`} title="Smallest next step">
        <p className="resurrect-block-text">{plan.smallestNextStep}</p>
      </Block>
      <Block id={`${idPrefix}-time`} title="Time estimate">
        <p className="resurrect-block-text">{EFFORT_LABEL[plan.effort]}</p>
      </Block>

      <Block id={`${idPrefix}-issue`} title="Drafted issue">
        <h5 className="resurrect-issue-heading">Issue title</h5>
        <p className="resurrect-issue-title">{plan.issueTitle}</p>
        <h5 className="resurrect-issue-heading">Issue body</h5>
        <div
          className="resurrect-issue-body"
          role="region"
          aria-label="Issue body, read-only preview"
          tabIndex={0}
        >
          {plan.issueBody}
        </div>

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
      </Block>
    </>
  );
}
