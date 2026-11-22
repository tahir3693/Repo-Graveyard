import { connection } from "next/server";
import { Suspense } from "react";
import { NotSignedIn } from "@/components/NotSignedIn";
import { SkipLink } from "@/components/SkipLink";
import { readSessionUser } from "@/lib/auth/server-session";
import { isAuthConfigured } from "@/lib/env";
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
  if (demo === "1") return <GraveyardView demo />;
  // Own graveyard: the session decides. The scan route re-checks the token itself.
  // connection() keeps the Auth.js session read (random values) out of prerender.
  await connection();
  const user = await readSessionUser(process.env);
  if (user === null) return <NotSignedIn signInConfigured={isAuthConfigured(process.env)} />;
  return <GraveyardView demo={false} />;
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
