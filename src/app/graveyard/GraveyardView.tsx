"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraveDrawer } from "@/components/GraveDrawer";
import { GraveyardControls } from "@/components/GraveyardControls";
import { GraveyardError } from "@/components/GraveyardError";
import { GraveyardHeader, type GraveyardBadge } from "@/components/GraveyardHeader";
import { GraveyardScene } from "@/components/GraveyardScene";
import { GraveyardSkeleton } from "@/components/GraveyardSkeleton";
import { ResurrectArea } from "@/components/ResurrectArea";
import { Tombstone } from "@/components/Tombstone";
import {
  fileIssue,
  GraveyardRequestError,
  resurrectRepo,
  scanRepos,
} from "@/lib/graveyard/client";
import { buildDrawerFacts } from "@/lib/graveyard/drawer-facts";
import { buildGraveEntries, countAlive, type GraveEntry } from "@/lib/graveyard/tombstones";
import {
  countByStatus,
  filterEntries,
  resultsText,
  sortEntries,
  summaryText,
  type Filter,
  type SortKey,
} from "@/lib/graveyard/view";

type ViewState =
  | { phase: "loading" }
  | { phase: "error"; code: string | null }
  | { phase: "ready"; entries: GraveEntry[]; sampleData: boolean };

export interface GraveyardViewProps {
  demo: boolean;
  /** The signed-in login (own graveyard only), or null. Never a token. */
  login?: string | null;
}

const NO_ENTRIES: readonly GraveEntry[] = [];

function badgeFor(demo: boolean, sampleData: boolean): GraveyardBadge | null {
  if (sampleData) return "Sample repos";
  return demo ? "Demo" : null;
}

/**
 * Scans once per mount (or per retry), scores the repos with the deterministic rules,
 * and renders one tombstone per repo. Opening a stone shows the detail drawer.
 */
export function GraveyardView({ demo, login = null }: GraveyardViewProps) {
  const [state, setState] = useState<ViewState>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [openName, setOpenName] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
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

  const entries = state.phase === "ready" ? state.entries : NO_ENTRIES;
  const counts = useMemo(() => countByStatus(entries), [entries]);
  const visible = useMemo(
    () => sortEntries(filterEntries(entries, filter), sort),
    [entries, filter, sort],
  );

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
      <>
        <GraveyardHeader summary={null} badge={demo ? "Demo" : null} login={login} />
        <GraveyardSkeleton />
      </>
    );
  }

  if (state.phase === "error") {
    return (
      <>
        <GraveyardHeader summary={null} badge={demo ? "Demo" : null} login={login} />
        <GraveyardError code={state.code} onRetry={retry} titleRef={errorRef} />
      </>
    );
  }

  const header = (
    <GraveyardHeader
      summary={summaryText(counts)}
      badge={badgeFor(demo, state.sampleData)}
      login={login}
    />
  );

  if (entries.length === 0) {
    return (
      <>
        {header}
        <p className="graveyard-message" role="status">
          No repos to visit yet. The graveyard is empty, which is a good sign.
        </p>
      </>
    );
  }

  const open = entries.find((entry) => entry.repo.name === openName) ?? null;

  return (
    <>
      {header}
      <GraveyardControls
        filter={filter}
        sort={sort}
        counts={counts}
        onFilter={setFilter}
        onSort={setSort}
      />
      <p className="graveyard-results" role="status">
        {resultsText(visible.length, entries.length)}
      </p>

      <div className="graveyard-scene-wrap">
        <GraveyardScene alive={countAlive(entries)} total={entries.length}>
          {visible.length === 0 ? (
            <div className="graveyard-message graveyard-empty" role="status">
              <p className="graveyard-empty-title">No repos rest here.</p>
              <button type="button" className="graveyard-button" onClick={() => setFilter("all")}>
                Show all
              </button>
            </div>
          ) : (
            <ul className="graveyard-stones" aria-label="Graveyard" ref={listRef}>
              {visible.map(({ repo, tombstone }) => (
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
          )}
        </GraveyardScene>
      </div>

      {open ? (
        <GraveDrawer
          key={open.repo.name}
          name={open.repo.name}
          status={open.tombstone.status}
          score={open.tombstone.score}
          causeLabel={open.tombstone.cause.label}
          epitaph={open.tombstone.epitaph}
          facts={buildDrawerFacts(open.repo, open.tombstone)}
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
