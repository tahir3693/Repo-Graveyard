import { GraveyardScene } from "@/components/GraveyardScene";
import { SignInButton } from "@/components/SignInButton";
import { SkipLink } from "@/components/SkipLink";
import { Tombstone } from "@/components/Tombstone";
import "./landing.css";

const STEPS = [
  "Scan your repos",
  "See which ones died and why",
  "Get a revival plan",
];

export default function Home() {
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
          <div className="landing-actions">
            <SignInButton />
            {/* A GET form submits to /graveyard?demo=1 with no client JavaScript. */}
            <form action="/graveyard" method="get" className="landing-demo-form">
              <input type="hidden" name="demo" value="1" />
              <button type="submit" className="landing-action landing-action-secondary">
                Try demo graveyard
              </button>
            </form>
          </div>
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
