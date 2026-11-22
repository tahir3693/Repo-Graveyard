import { describe, expect, it } from "vitest";
import { deriveRepoHealth } from "@/lib/resurrection/context";
import { getSampleContext, isSampleRepoName } from "./sample-context";
import { getSampleRepos } from "./sample-repos";

const NOW = new Date("2025-06-01T00:00:00Z");

describe("sample context", () => {
  it("has a context for every sample repo and for nothing else", () => {
    for (const repo of getSampleRepos(NOW)) {
      expect(isSampleRepoName(repo.name, NOW)).toBe(true);
      expect(getSampleContext(repo.name, NOW)).not.toBeNull();
    }
    for (const name of ["todo-app", "__proto__", "constructor", "", "Ghost-Ledger"]) {
      expect(isSampleRepoName(name, NOW)).toBe(false);
      expect(getSampleContext(name, NOW)).toBeNull();
    }
  });

  it("derives the same health the sample list shows", () => {
    for (const repo of getSampleRepos(NOW)) {
      const raw = getSampleContext(repo.name, NOW);
      expect(raw).not.toBeNull();
      if (raw !== null) expect(deriveRepoHealth(raw, NOW)).toEqual(repo);
    }
  });
});
