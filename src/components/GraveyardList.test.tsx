import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getSampleRepos } from "@/lib/demo/sample-repos";
import { buildGraveEntries } from "@/lib/graveyard/tombstones";
import { GraveyardList } from "./GraveyardList";

const NOW = new Date("2025-06-01T00:00:00Z");
const entries = buildGraveEntries(getSampleRepos(NOW), NOW);
const html = renderToStaticMarkup(<GraveyardList entries={entries} onSelect={() => undefined} />);
const text = (fragment: string) => fragment.replace(/<[^>]+>/g, "");

describe("GraveyardList", () => {
  it("is a table with the six column headers in order", () => {
    const headers = [...html.matchAll(/<th[^>]*scope="col"[^>]*>(.*?)<\/th>/g)].map((m) => text(m[1] ?? ""));
    expect(headers).toEqual(["Repo", "Status", "Cause", "Last commit", "Stars", "CI"]);
    expect(html).toContain('aria-label="Graveyard list"');
  });

  it("has one row per repo, each with the repo as a row header holding a real button", () => {
    const rowHeaders = [...html.matchAll(/<th[^>]*scope="row"[^>]*><button type="button"[^>]*>(.*?)<\/button><\/th>/g)];
    expect(rowHeaders.map((m) => m[1])).toEqual(entries.map((e) => e.repo.name));
    expect(html.match(/<tr[^>]*data-repo=/g)).toHaveLength(entries.length);
  });

  it("writes status, cause, last commit, stars and CI as text in every row", () => {
    const row = [...html.matchAll(/<tr[^>]*data-repo="ghost-ledger"[^>]*>(.*?)<\/tr>/g)][0]?.[1] ?? "";
    const cells = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((m) => text(m[1] ?? ""));
    expect(cells).toEqual(["Dead", "Abandoned with failing CI", "10 months ago", "3", "Failing"]);
  });

  it("pairs every status with an icon shape, not only a color", () => {
    expect(html.match(/tombstone-status-icon/g)).toHaveLength(entries.length);
  });
});
