"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { STATUS_LABEL, StatusIcon, type TombstoneStatus } from "./Tombstone";
import "./GraveDrawer.css";

export interface GraveDrawerProps {
  name: string;
  status: TombstoneStatus;
  score: number;
  causeLabel: string;
  epitaph: string;
  /** Shown as a link only when it is an https://github.com URL. */
  url: string;
  /** Called on Escape, the Close button and a backdrop click. The parent restores focus. */
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
  url,
  onClose,
  children,
}: GraveDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();

    // Escape fires "cancel". Keep React in charge of closing.
    const onCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) dialog.close();
    };
  }, []);

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
    const outside = !(active instanceof Node) || !items.includes(active as HTMLElement);
    if (event.shiftKey && (active === first || outside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || outside)) {
      event.preventDefault();
      first.focus();
    }
  };

  // A click on the dialog element itself (not its content) is a click on the backdrop.
  const onClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) onClose();
  };

  const failing = status !== "alive";

  return (
    <dialog
      ref={dialogRef}
      className="drawer"
      aria-modal="true"
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <div className="drawer-body">
        <div className="drawer-header">
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className="drawer-title">
            {name}
          </h2>
          <button type="button" className="drawer-close" onClick={onClose}>
            Close
          </button>
        </div>

        <dl className="drawer-facts">
          <div className="drawer-fact">
            <dt>Status</dt>
            <dd
              className={`drawer-status ${failing ? "drawer-status-failing" : "drawer-status-alive"}`}
            >
              <StatusIcon status={status} />
              {STATUS_LABEL[status]}
            </dd>
          </div>
          <div className="drawer-fact">
            <dt>Death score</dt>
            <dd>{score} of 100</dd>
          </div>
          <div className="drawer-fact">
            <dt>Cause of death</dt>
            <dd>{causeLabel}</dd>
          </div>
        </dl>

        <p className="drawer-epitaph">{epitaph}</p>

        {isGithubUrl(url) ? (
          <a className="drawer-link" href={url} target="_blank" rel="noopener noreferrer">
            Open on GitHub
          </a>
        ) : null}

        {children}
      </div>
    </dialog>
  );
}
