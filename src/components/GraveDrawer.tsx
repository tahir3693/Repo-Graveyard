"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { DrawerFact } from "@/lib/graveyard/drawer-facts";
import { RevivingIcon, STATUS_LABEL, StatusIcon, type TombstoneStatus } from "./Tombstone";
import "./GraveDrawer.css";

export interface GraveDrawerProps {
  name: string;
  status: TombstoneStatus;
  score: number;
  causeLabel: string;
  epitaph: string;
  /** Last commit, stars, CI, dependencies and open issues, as plain text. */
  facts: readonly DrawerFact[];
  /** Shown as a link only when it is an https://github.com URL. */
  url: string;
  /**
   * True once a revival plan has arrived for this repo. The badge then says "Reviving"
   * with a flame instead of the death status. Presentation only: the score and the
   * status the rules gave are not changed.
   */
  reviving?: boolean;
  /**
   * Called on Escape, the Close button and a backdrop click, after the exit animation
   * (at once under reduced motion). The parent restores focus.
   */
  onClose: () => void;
  /** The Resurrect area. Kept as a slot so this component stays free of data fetching. */
  children?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isGithubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "github.com";
  } catch {
    return false;
  }
}

/**
 * Detail drawer: a native modal <dialog>, so the page behind it is inert.
 * Focus moves to the heading on open, Tab and Shift+Tab cycle inside the drawer,
 * and Escape, Close or a backdrop click call `onClose`.
 */
export function GraveDrawer({
  name,
  status,
  score,
  causeLabel,
  epitaph,
  facts,
  url,
  reviving = false,
  onClose,
  children,
}: GraveDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const onCloseRef = useRef(onClose);
  // Closing runs the exit animation first, then tells the parent. Each step happens once.
  const [closing, setClosing] = useState(false);
  const closeRequested = useRef(false);
  const closeDone = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const finishClose = useCallback(() => {
    if (closeDone.current) return;
    closeDone.current = true;
    onCloseRef.current();
  }, []);

  const requestClose = useCallback(() => {
    if (closeRequested.current) return;
    closeRequested.current = true;
    // Under reduced motion there is no exit animation: close at once.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishClose();
      return;
    }
    setClosing(true);
  }, [finishClose]);

  // Safety net: if the exit animation never reports its end, still close.
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(finishClose, 500);
    return () => window.clearTimeout(timer);
  }, [closing, finishClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();

    // Escape fires "cancel". Keep React in charge of closing.
    const onCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) dialog.close();
    };
  }, [requestClose]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.getAttribute("aria-hidden") !== "true",
    );
    if (items.length === 0) {
      event.preventDefault();
      headingRef.current?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const listed = active instanceof HTMLElement && items.includes(active);

    // On a listed control, the browser handles every step except wrapping at the ends.
    if (listed) {
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }

    // Focus is on something unlisted (the plan heading has tabindex -1) or outside the
    // dialog. Continue from its position in the page, wrapping at the ends.
    event.preventDefault();
    if (!(active instanceof Node) || !dialog.contains(active)) {
      (event.shiftKey ? last : first).focus();
      return;
    }
    const after = items.filter((el) => active.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    const before = items.filter((el) => active.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
    const target = event.shiftKey ? before[before.length - 1] ?? last : after[0] ?? first;
    target.focus();
  };

  // A click on the dialog element itself (not its content) is a click on the backdrop.
  const onClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) requestClose();
  };

  // Only the dialog's own exit animation ends the close, not a child's or the backdrop's.
  const onAnimationEnd = (event: React.AnimationEvent<HTMLDialogElement>) => {
    if (closing && event.target === event.currentTarget && event.animationName.startsWith("drawer-out")) {
      finishClose();
    }
  };

  const failing = status !== "alive";
  const badgeTone = reviving ? "reviving" : failing ? "failing" : "alive";

  return (
    <dialog
      ref={dialogRef}
      className={closing ? "drawer drawer-closing" : "drawer"}
      aria-modal="true"
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="drawer-top">
        <div className="drawer-header">
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className="drawer-title">
            {name}
          </h2>
          <button type="button" className="btn btn-secondary drawer-close" onClick={requestClose}>
            <span aria-hidden="true">{"\u00d7"}</span>
            Close
          </button>
        </div>

        <p className="drawer-badges">
          <span className={`drawer-status drawer-status-${badgeTone}`}>
            {reviving ? <RevivingIcon /> : <StatusIcon status={status} />}
            {reviving ? "Reviving" : STATUS_LABEL[status]}
          </span>
          <span className="drawer-score">Death score {score} of 100</span>
        </p>

        <p className="drawer-cause">
          <span className="drawer-cause-label">Cause of death:</span> {causeLabel}
        </p>
      </div>

      <div className="drawer-body">
        <dl className="drawer-facts" aria-label="Repo facts">
          {facts.map((fact) => (
            <div key={fact.key} className="drawer-fact">
              <dt>{fact.label}</dt>
              <dd className={fact.tone === "warn" ? "drawer-fact-warn" : undefined}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        <p className="drawer-epitaph">{epitaph}</p>

        {isGithubUrl(url) ? (
          <a className="btn btn-secondary drawer-link" href={url} target="_blank" rel="noopener noreferrer">
            Open on GitHub
          </a>
        ) : null}

        {children}
      </div>    </dialog>
  );
}
