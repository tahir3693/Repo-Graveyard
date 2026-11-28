import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { GraveyardScene } from "@/components/GraveyardScene";
import { LandingActions } from "@/components/LandingActions";
import { SkipLink } from "@/components/SkipLink";
import { Tombstone } from "@/components/Tombstone";
import { readAuthErrorMessage } from "@/lib/auth/error-messages";
import { isAuthConfigured } from "@/lib/env";
import { readSessionUser } from "@/lib/auth/server-session";
import "./landing.css";

const STEPS = [
  { title: "Scan", text: "We read your repos." },
  { title: "Judge", text: "We score which ones died and why." },
  { title: "Revive", text: "You get a plan and a ready-to-file issue." },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Reads the session and the `error` param per request, inside Suspense. */
async function LandingActionsForRequest({ searchParams }: { searchParams: SearchParams }) {
  // Await the request-time params first so the session read never runs during prerender.
  const { error } = await searchParams;
  // Auth.js generates random values while reading the session, which Next.js refuses to do
  // during prerender. connection() moves this render to request time.
  await connection();
  const user = await readSessionUser(process.env);
  return (
    <LandingActions
      login={user?.login ?? null}
      errorMessage={readAuthErrorMessage(error)}
      signInConfigured={isAuthConfigured(process.env)}
    />
  );
}

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <SkipLink targetId="main" />
      <div className="landing">
        <header className="landing-topbar">
          <div className="landing-topbar-inner">
            <Link href="/" className="landing-wordmark">
              Repo Graveyard
            </Link>
            <a href="/graveyard?demo=1" className="btn btn-secondary">
              Demo
            </a>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="landing-main">
          {/* The stage holds the hero text over a soft moon glow and two slow fog layers.
              The layers are decorative (aria-hidden) and add no tab stops. */}
          <div className="landing-stage">
            <div className="landing-sky" aria-hidden="true">
              <span className="landing-moon-glow" />
              <span className="landing-fog landing-fog-back" />
              <span className="landing-fog landing-fog-front" />
            </div>
            <section className="landing-hero" aria-labelledby="landing-title">
              <h1 id="landing-title" className="landing-title">
                Repo Graveyard
              </h1>
              <p className="landing-tagline">
                Find your dead repos and get a plan to revive them.
              </p>
              <Suspense fallback={<LandingActions login={null} errorMessage={null} />}>
                <LandingActionsForRequest searchParams={searchParams} />
              </Suspense>
              <p className="landing-note">
                No account needed for the demo. We only read public repos.
              </p>
            </section>
          </div>

          {/* Decorative sample stones. inert keeps their buttons out of the tab order. */}
          <section className="landing-preview" aria-hidden="true" inert>
            <GraveyardScene alive={2} total={6}>
              <div className="landing-stones">
                <Tombstone
                  name="todo-app"
                  cause="Quietly retired"
                  epitaph="Here lies todo-app. Last words: // TODO: finish this."
                  status="dead"
                  candle={false}
                />
                <Tombstone
                  name="weather-cli"
                  cause="Abandoned with failing CI"
                  epitaph="Its tests are red, but its ideas are still alive."
                  status="dying"
                  candle={false}
                />
                <Tombstone
                  name="portfolio-v2"
                  cause="Still active"
                  epitaph="It compiled once. We will always remember that."
                  status="alive"
                  candle
                />
              </div>
            </GraveyardScene>
          </section>

          <section aria-labelledby="how-it-works" className="landing-how">
            <h2 id="how-it-works" className="landing-how-title">
              How it works
            </h2>
            <ol className="landing-steps">
              {STEPS.map((step, index) => (
                <li key={step.title} className="landing-step">
                  <span className="landing-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <h3 className="landing-step-title">{step.title}</h3>
                  <p className="landing-step-text">{step.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </main>

        <footer className="landing-footer">
          <p>Built with Kiro for Kiroween 2026</p>
        </footer>
      </div>
    </>
  );
}
