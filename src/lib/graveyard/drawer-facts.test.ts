import { describe, expect, it } from "vitest";
import { getSampleRepos } from "@/lib/demo/sample-repos";
import { buildDrawerFacts, formatLastCommit } from "@/lib/graveyard/drawer-facts";
import { buildGraveEntries } from "@/lib/graveyard/tombstones";
import { buildIssueText } from "@/lib/graveyard/issue-text";

const NOW = new Date("2026-11-22T12:00:00.000Z");
const entries = buildGraveEntries(getSampleRepos(NOW), NOW);
const byName = (name: string) => {
  const entry = entries.find((e) => e.repo.name === name);
  if (entry === undefined) throw new Error(`missing sample ${name}`);
  return entry;
};
const valueOf = (facts: ReturnType<typeof buildDrawerFacts>, key: string) =>
  facts.find((f) => f.key === key);

describe("formatLastCommit", () => {
  it.each([
    [null, "No commits found"],
    [0, "Today"],
    [1, "Yesterday"],
    [6, "6 days ago"],
    [59, "59 days ago"],
    [60, "2 months ago"],
    [150, "5 months ago"],
    [729, "24 months ago"],
    [730, "2 years ago"],
    [1100, "3 years ago"],
  ])("%s days becomes %s", (days, text) => {
    expect(formatLastCommit(days)).toBe(text);
  });
});

describe("buildDrawerFacts", () => {
  it("always returns the five facts in a fixed order", () => {
    for (const { repo, tombstone } of entries) {
      expect(buildDrawerFacts(repo, tombstone).map((f) => f.key)).toEqual([
        "lastCommit",
        "stars",
        "ci",
        "deps",
        "issues",
      ]);
    }
  });

  it("spells out failing CI and outdated dependencies in words and marks them as warnings", () => {
    const { repo, tombstone } = byName("ghost-ledger");
    const facts = buildDrawerFacts(repo, tombstone);
    expect(valueOf(facts, "ci")).toMatchObject({ value: "Failing", tone: "warn" });
    const outdated = byName("pale-weather");
    const deps = valueOf(buildDrawerFacts(outdated.repo, outdated.tombstone), "deps");
    expect(deps).toMatchObject({ value: "Outdated", tone: "warn" });
  });

  it("uses normal tone for healthy values and a clear word for each", () => {
    const { repo, tombstone } = byName("moonlit-notes");
    const facts = buildDrawerFacts(repo, tombstone);
    expect(valueOf(facts, "ci")).toMatchObject({ value: "Passing", tone: "normal" });
    expect(valueOf(facts, "deps")).toMatchObject({ value: "Up to date", tone: "normal" });
    expect(valueOf(facts, "lastCommit")?.value).toBe("6 days ago");
    expect(valueOf(facts, "stars")?.value).toBe("42");
    expect(valueOf(facts, "issues")?.value).toBe("1");
  });

  it("says No CI and Unknown when the data is missing", () => {
    const { repo, tombstone } = byName("sunken-bell");
    const facts = buildDrawerFacts(repo, tombstone);
    expect(valueOf(facts, "ci")?.value).toBe("No CI");
    expect(valueOf(facts, "deps")?.value).toBe("Unknown");
  });
});

describe("buildIssueText", () => {
  it("joins the title and body with a blank line", () => {
    expect(buildIssueText("Revive todo-app", "Bump the lockfile.")).toBe("Revive todo-app\n\nBump the lockfile.");
  });
});
