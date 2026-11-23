/**
 * The two ways to look at the graveyard, and how the choice lives in the URL (?view=list).
 * Pure: no I/O, no window access. The graveyard scene is the default and is left out of the URL.
 */
export const VIEW_MODES = ["graveyard", "list"] as const;
export type GraveyardViewMode = (typeof VIEW_MODES)[number];

export const VIEW_MODE_LABEL: Record<GraveyardViewMode, string> = {
  graveyard: "Graveyard",
  list: "List",
};

export const VIEW_PARAM = "view";

/** Only the exact value "list" selects the list. Anything else, or nothing, is the graveyard. */
export function parseViewMode(value: string | readonly string[] | null | undefined): GraveyardViewMode {
  const first = typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
  return first === "list" ? "list" : "graveyard";
}

/**
 * The query string (with a leading "?", or "" when empty) for `mode`, keeping every other
 * parameter such as `demo=1`. The default mode removes the parameter, so URLs stay clean.
 */
export function withViewMode(search: string, mode: GraveyardViewMode): string {
  const params = new URLSearchParams(search);
  if (mode === "list") params.set(VIEW_PARAM, "list");
  else params.delete(VIEW_PARAM);
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}
