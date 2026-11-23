import { describe, expect, it } from "vitest";
import { getSampleRepos } from "@/lib/demo/sample-repos";
import { buildGraveEntries } from "@/lib/graveyard/tombstones";
import { buildListRows, LIST_COLUMNS } from "./list-rows";

const NOW = new Date("2025-06-01T00:00:00Z");
const entries = buildGraveEntries(getSampleRepos(NOW), NOW);

describe("buildListRows", () => {
  const rows = buildListRows(entries);

  it("has one row per entry, in the same order", () => {
    expect(rows.map((r) => r.name)).toEqual(entries.map((e) => e.repo.name));
  });

  it("lists the six columns in the agreed order", () => {
    expect(LIST_COLUMNS).toEqual(["Repo", "Status", "Cause", "Last commit", "Stars", "CI"]);
  });

  it("uses the scored status and cause, and plain text for the rest", () => {
    const ghost = rows.find((r) => r.name === "ghost-ledger");
    expect(ghost).toEqual({
      name: "ghost-ledger",
      status: "dead",
      statusLabel: "Dead",
      cause: "Abandoned with failing CI",
      lastCommit: "10 months ago",
      stars: "3",
      ci: "Failing",
    });
  });

  it("says No CI instead of leaving the cell empty", () => {
    expect(rows.find((r) => r.name === "sunken-bell")?.ci).toBe("No CI");
  });

  it("covers every status in the sample data", () => {
    expect(new Set(rows.map((r) => r.statusLabel))).toEqual(new Set(["Alive", "Dying", "Dead", "Ancient"]));
  });
});
