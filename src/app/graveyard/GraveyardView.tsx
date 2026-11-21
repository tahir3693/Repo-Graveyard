"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GraveDrawer } from "@/components/GraveDrawer";
import { GraveyardScene } from "@/components/GraveyardScene";
import { ResurrectArea } from "@/components/ResurrectArea";
import { Tombstone } from "@/components/Tombstone";
import { fileIssue, resurrectRepo, scanRepos } from "@/lib/graveyard/client";
import { buildGraveEntries, countAlive, type GraveEntry } from "@/lib/graveyard/tombstones";

type ViewState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; entries: GraveEntry[] };

export interface GraveyardViewProps {
  demo: boolean;
}

/**
 * Scans once per mount (or per retry), scores the repos with the deterministic rules,
 * and renders one tombstone per repo. Opening a stone shows the detail drawer.
 */
export function GraveyardView({ demo }: GraveyardViewProps) {
  const [state, setState] = useState<ViewState>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [openName, setOpenName] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const errorRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    scanRepos({ demo, signal: controller.signal })
      .then((scan) => {
        // The browser clock is read here, outside scoring, and passed in as `now`.
        setState({ phase: "ready", entries: buildGraveEntries(scan.repos, new Date()) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ phase: "error" });
      });
    return () => controller.abort();
  }, [demo, attempt]);

  useEffect(() => {
    if (state.phase === "error") errorRef.current?.focus();
  }, [state.phase]);

  const retry = () => {
    setState({ phase: "loading" });
    setAttempt((n) => n + 1);
  };

  const closeDrawer = useCallback(() => {
    const name = openName;
    setOpenName(null);
    if (name === null) return;
    // Return focus to the stone that opened the drawer.
    const stone = [...(listRef.current?.querySelectorAll<HTMLLIElement>("li") ?? [])]
      .find((li) => li.dataset.repo === name)
      ?.querySelector("button");
    requestAnimationFrame(() => stone?.focus());
  }, [openName]);

  if (state.phase === "loading") {
    return (
      <p className="graveyard-message" role="status">
        <span className="graveyard-message-icon" aria-hidden="true" />
        Digging up the graveyard{"\u2026"}
      </p>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="graveyard-error" role="alert">
        <h2 className="graveyard-error-title" tabIndex={-1} ref={errorRef}>
          The graveyard gates are stuck
        </h2>
        <p className="graveyard-error-text">
          The repos could not be read this time. They are only resting. Try again in a moment.
        </p>
        <button type="button" className="graveyard-button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  const { entries } = state;

  if (entries.length === 0) {
    return (
      <p className="graveyard-message" role="status">
        No repos to visit yet. The graveyard is empty, which is a good sign.
      </p>
    );
  }

  const open = entries.find((entry) => entry.repo.name === openName) ?? null;

  return (
    <>
      <GraveyardScene alive={countAlive(entries)} total={entries.length}>
        <ul className="graveyard-stones" aria-label="Graveyard" ref={listRef}>
          {entries.map(({ repo, tombstone }) => (
            <li key={repo.name} className="graveyard-stone" data-repo={repo.name}>
              <Tombstone
                name={repo.name}
                status={tombstone.status}
                cause={tombstone.cause.label}
                epitaph={tombstone.epitaph}
                candle={tombstone.scene.candle}
                onSelect={() => setOpenName(repo.name)}
              />
            </li>
          ))}
        </ul>
      </GraveyardScene>

      {open ? (
        <GraveDrawer
          key={open.repo.name}
          name={open.repo.name}
          status={open.tombstone.status}
          score={open.tombstone.score}
          causeLabel={open.tombstone.cause.label}
          epitaph={open.tombstone.epitaph}
          url={open.repo.url}
          onClose={closeDrawer}
        >
          <ResurrectArea
            repoName={open.repo.name}
            onResurrect={() => resurrectRepo(open.repo.name, { demo })}
            demo={demo}
            onFileIssue={(issue) => fileIssue(open.repo.name, issue)}
          />
        </GraveDrawer>
      ) : null}
    </>
  );
}
