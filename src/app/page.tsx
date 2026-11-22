import { Suspense } from "react";
import { GraveyardScene } from "@/components/GraveyardScene";
import { LandingActions } from "@/components/LandingActions";
import { SkipLink } from "@/components/SkipLink";
import { Tombstone } from "@/components/Tombstone";
import { readAuthErrorMessage } from "@/lib/auth/error-messages";
import { readSessionUser } from "@/lib/auth/server-session";
import "./landing.css";

const STEPS = [
  "Scan your repos",
  "See which ones died and why",
  "Get a revival plan",
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Reads the session and the `error` param per request, inside Suspense. */
async function LandingActionsForRequest({ searchParams }: { searchParams: SearchParams }) {
  const [{ error }, user] = await Promise.all([searchParams, readSessionUser()]);
  return <LandingActions login={user?.login ?? null} errorMessage={readAuthErrorMessage(error)} />;
}

export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <SkipLink targetId="main" />
      <div className="landing">
        {/* Decorative sample stones. inert keeps their buttons out of the tab order. */}
        <div className="landing-bg" aria-hidden="true" inert>
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
        </div>
        <main id="main" tabIndex={-1} className="landing-main">
          <h1 className="landing-title">Repo Graveyard</h1>
          <p className="landing-tagline">
            Find your dead repos and get a plan to revive them.
          </p>
          <Suspense fallback={<LandingActions login={null} errorMessage={null} />}>
            <LandingActionsForRequest searchParams={searchParams} />
          </Suspense>
          <section aria-labelledby="how-it-works" className="landing-how">
            <h2 id="how-it-works" className="landing-how-title">
              How it works
            </h2>
            <ol className="landing-steps">
              {STEPS.map((step) => (
                <li key={step} className="landing-step">
                  {step}
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
