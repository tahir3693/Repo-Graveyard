"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GraveDrawer } from "@/components/GraveDrawer";
import { GraveyardError } from "@/components/GraveyardError";
import { GraveyardScene } from "@/components/GraveyardScene";
import { ResurrectArea } from "@/components/ResurrectArea";
import { Tombstone } from "@/components/Tombstone";
import {
  fileIssue,
  GraveyardRequestError,
  resurrectRepo,
  scanRepos,
} from "@/lib/graveyard/client";
import { buildGraveEntries, countAlive, type GraveEntry } from "@/lib/graveyard/tombstones";

type ViewState =
  | { phase: "loading" }
  | { phase: "error"; code: string | null }
  | { phase: "ready"; entries: GraveEntry[]; sampleData: boolean };

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
        setState({
          phase: "ready",
          entries: buildGraveEntries(scan.repos, new Date()),
          sampleData: scan.sampleData === true,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // Keep only the typed code. Nothing else from the failure reaches the page.
        const code = error instanceof GraveyardRequestError ? error.code : null;
        setState({ phase: "error", code });
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
      <GraveyardError code={state.code} demo={demo} onRetry={retry} titleRef={errorRef} />
    );
  }

  const { entries, sampleData } = state;

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
      {sampleData ? (
        <p className="graveyard-sample-note" role="status">
          Showing sample repos
        </p>
      ) : null}
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
