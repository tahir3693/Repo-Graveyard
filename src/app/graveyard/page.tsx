import { Suspense } from "react";
import { SkipLink } from "@/components/SkipLink";
import { GraveyardView } from "./GraveyardView";
import "./graveyard.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function LoadingMessage() {
  return (
    <p className="graveyard-message" role="status">
      <span className="graveyard-message-icon" aria-hidden="true" />
      Digging up the graveyard{"\u2026"}
    </p>
  );
}

/** Reads the request-time `demo` param inside Suspense, so the shell above stays static. */
async function GraveyardForRequest({ searchParams }: { searchParams: SearchParams }) {
  const { demo } = await searchParams;
  return <GraveyardView demo={demo === "1"} />;
}

export default function GraveyardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <SkipLink targetId="main" />
      <main id="main" tabIndex={-1} className="graveyard-main">
        <h1 className="graveyard-title">The graveyard</h1>
        <Suspense fallback={<LoadingMessage />}>
          <GraveyardForRequest searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
