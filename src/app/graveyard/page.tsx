import { connection } from "next/server";
import { Suspense } from "react";
import { GraveyardHeader } from "@/components/GraveyardHeader";
import { GraveyardSkeleton } from "@/components/GraveyardSkeleton";
import { NotSignedIn } from "@/components/NotSignedIn";
import { SkipLink } from "@/components/SkipLink";
import { readSessionUser } from "@/lib/auth/server-session";
import { isAuthConfigured } from "@/lib/env";
import { parseViewMode } from "@/lib/graveyard/view-mode";
import { GraveyardView } from "./GraveyardView";
import "./graveyard.css";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Reads the request-time `demo` param inside Suspense, so the shell above stays static. */
async function GraveyardForRequest({ searchParams }: { searchParams: SearchParams }) {
  const { demo, view } = await searchParams;
  const initialView = parseViewMode(view);
  // Demo mode never reads the session (security.md, Demo mode), so it has no Sign out.
  if (demo === "1") return <GraveyardView demo initialView={initialView} />;
  // Own graveyard: the session decides. The scan route re-checks the token itself.
  // connection() keeps the Auth.js session read (random values) out of prerender.
  await connection();
  const user = await readSessionUser(process.env);
  if (user === null) {
    return (
      <>
        <GraveyardHeader summary={null} badge={null} login={null} />
        <NotSignedIn signInConfigured={isAuthConfigured(process.env)} />
      </>
    );
  }
  return <GraveyardView demo={false} login={user.login} initialView={initialView} />;
}

function LoadingShell() {
  return (
    <>
      <GraveyardHeader summary={null} badge={null} login={null} />
      <GraveyardSkeleton />
    </>
  );
}

export default function GraveyardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <SkipLink targetId="main" />
      <main id="main" tabIndex={-1} className="graveyard-main">
        <Suspense fallback={<LoadingShell />}>
          <GraveyardForRequest searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
