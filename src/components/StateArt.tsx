import "./StateArt.css";

/**
 * Small illustrations for the loading, empty and error states. Pure SVG, no emoji.
 * They are decorative (aria-hidden): the text next to them says the same thing.
 */
const SVG_PROPS = {
  viewBox: "0 0 64 80",
  "aria-hidden": true,
  focusable: false,
} as const;

/**
 * A lantern. Lit while something is happening or waiting for the reader (loading, sign in).
 * Unlit when something went wrong (error). A lit lantern breathes slowly when `pulsing`.
 */
export function LanternArt({ lit, pulsing = false }: { lit: boolean; pulsing?: boolean }) {
  return (
    <svg
      {...SVG_PROPS}
      className={`state-art state-art-lantern${pulsing ? " state-art-pulse" : ""}`}
      data-lit={lit ? "true" : "false"}
    >
      {lit ? (
        <>
          <circle className="state-art-halo" cx="32" cy="46" r="28" />
          <circle className="state-art-halo-core" cx="32" cy="46" r="17" />
        </>
      ) : null}
      <path className="state-art-line" d="M26 14C26 5 38 5 38 14" />
      <path className="state-art-metal" d="M22 22 24 14H40L42 22Z" />
      <path className="state-art-glass" d="M22 22H42L46 30V56L42 64H22L18 56V30Z" />
      <path className="state-art-metal" d="M16 64H48V70H16Z" />
      {lit ? (
        <path className="state-art-flame" d="M32 34C38 42 39 49 32 56 25 49 26 42 32 34Z" />
      ) : (
        <>
          <path className="state-art-flame-off" d="M32 38C36.5 44 37 49 32 54 27 49 27.5 44 32 38Z" />
          <path className="state-art-line" d="M32 54V58" />
        </>
      )}
    </svg>
  );
}

/** An empty grave: an arched stone with nothing written yet, and a low mound in front. */
export function EmptyGraveArt() {
  return (
    <svg {...SVG_PROPS} className="state-art state-art-grave">
      <path className="state-art-glass" d="M14 66V32C14 18 22 10 32 10S50 18 50 32V66Z" />
      <path className="state-art-dashed" d="M22 58V36C22 29 26 25 32 25S42 29 42 36V58" />
      <path className="state-art-metal" d="M6 72C14 63 50 63 58 72V76H6Z" />
    </svg>
  );
}
