import { describe, expect, it } from "vitest";
import type { GitHubRepo } from "@/lib/github/schemas";
import { scoreRepo } from "@/lib/scoring";
import {
  buildCommitMessages,
  buildFileTree,
  buildIssueTitles,
  capBundle,
  ContextBundleSchema,
  deriveRepoHealth,
  type RawContext,
} from "./context";
import { RESURRECTION_LIMITS as L } from "./limits";

const NOW = new Date("2025-06-01T00:00:00Z");

const repo: GitHubRepo = {
  name: "todo-app",
  html_url: "https://github.com/octocat/todo-app",
  description: "A todo app",
  fork: false,
  archived: false,
  stargazers_count: 3,
  open_issues_count: 2,
  language: "TypeScript",
  pushed_at: "2024-01-01T00:00:00Z",
  default_branch: "main",
  owner: { login: "octocat" },
};

function raw(overrides: Partial<RawContext> = {}): RawContext {
  return {
    repo,
    readme: "# Hello",
    tree: [
      { path: "src", type: "tree" },
      { path: "README.md", type: "blob" },
      { path: "src/index.ts", type: "blob" },
    ],
    commits: [{ message: "fix: a\n\nbody", date: "2024-01-01T00:00:00Z" }],
    checks: [
      { name: "build", conclusion: "success" },
      { name: "test", conclusion: "failure" },
    ],
    issues: [{ title: "Bug" }],
    outdatedDeps: true,
    ...overrides,
  };
}

function bundleOf(r: RawContext) {
  const health = deriveRepoHealth(r, NOW);
  return capBundle(r, scoreRepo(health, NOW), health);
}

describe("capBundle", () => {
  it("builds a schema-valid bundle from trusted facts", () => {
    const b = bundleOf(raw());
    expect(ContextBundleSchema.safeParse(b).success).toBe(true);
    expect(b.fileTree).toEqual(["README.md", "src/"]);
    expect(b.commitMessages).toEqual(["fix: a"]);
    expect(b.ci).toEqual({ state: "failing", failingChecks: ["test"] });
    expect(b.outdatedDeps).toBe(true);
    expect(b.unavailable).toEqual([]);
  });

  it("does not truncate a README of exactly 6,000 code points", () => {
    const b = bundleOf(raw({ readme: "😀".repeat(L.CAP_README) }));
    expect(Array.from(b.readme)).toHaveLength(L.CAP_README);
    expect(b.readmeTruncated).toBe(false);
  });

  it("truncates a README of 6,001 code points", () => {
    const b = bundleOf(raw({ readme: "😀".repeat(L.CAP_README + 1) }));
    expect(Array.from(b.readme)).toHaveLength(L.CAP_README);
    expect(b.readmeTruncated).toBe(true);
  });

  it("caps each list at its limit and one above it", () => {
    const tree = (n: number) => Array.from({ length: n }, (_, i) => ({ path: `f${String(i).padStart(3, "0")}`, type: "blob" }));
    expect(buildFileTree(tree(50))).toHaveLength(50);
    expect(buildFileTree(tree(51))).toHaveLength(50);
    const msgs = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`);
    expect(buildCommitMessages(msgs(10))).toHaveLength(10);
    expect(buildCommitMessages(msgs(11))).toHaveLength(10);
    expect(buildIssueTitles(msgs(10))).toHaveLength(10);
    expect(buildIssueTitles(msgs(11))).toHaveLength(10);
    expect(buildFileTree([{ path: "a".repeat(80), type: "blob" }])[0]).toHaveLength(80);
    expect(buildFileTree([{ path: "a".repeat(81), type: "blob" }])[0]).toHaveLength(80);
    expect(buildCommitMessages(["a".repeat(201)])[0]).toHaveLength(200);
    expect(buildIssueTitles(["a".repeat(151)])[0]).toHaveLength(150);
  });

  it("keeps at most 5 failing checks, each at most 80 code points", () => {
    const checks = Array.from({ length: 8 }, (_, i) => ({ name: `${i}`.repeat(90), conclusion: "timed_out" }));
    const b = bundleOf(raw({ checks }));
    expect(b.ci.failingChecks).toHaveLength(5);
    expect(b.ci.failingChecks.every((c) => c.length === 80)).toBe(true);
  });

  it("maps each null raw field to unavailable with an empty value", () => {
    const b = bundleOf(raw({ readme: null, tree: null, commits: null, checks: null, issues: null }));
    expect(b.unavailable).toEqual(["readme", "fileTree", "commitMessages", "ci", "openIssueTitles"]);
    expect(b.readme).toBe("");
    expect(b.fileTree).toEqual([]);
    expect(b.ci).toEqual({ state: "none", failingChecks: [] });
  });

  it("handles an empty repo and a null description", () => {
    const b = bundleOf(
      raw({ repo: { ...repo, description: null, pushed_at: null }, readme: "", tree: [], commits: [], checks: [], issues: [], outdatedDeps: null }),
    );
    expect(b.description).toBeNull();
    expect(b.daysInactive).toBeNull();
    expect(b.ci.state).toBe("none");
    expect(b.unavailable).toEqual([]);
    expect(ContextBundleSchema.safeParse(b).success).toBe(true);
  });

  it("keeps the serialized size under the cap with quote-heavy text", () => {
    const b = bundleOf(raw({ readme: '"\\\n'.repeat(5000), issues: Array.from({ length: 30 }, () => ({ title: '"'.repeat(200) })) }));
    expect(JSON.stringify(b).length).toBeLessThanOrEqual(L.CAP_SERIALIZED);
  });

  it("carries no URL, token or query string", () => {
    const json = JSON.stringify(bundleOf(raw()));
    expect(json).not.toContain("https://");
    expect(json).not.toContain("?");
  });
});

describe("deriveRepoHealth", () => {
  it("uses pushed_at when the commit read failed and null for an empty repo", () => {
    expect(deriveRepoHealth(raw({ commits: null }), NOW).lastCommitAt).toBe(repo.pushed_at);
    expect(deriveRepoHealth(raw({ commits: [] }), NOW).lastCommitAt).toBeNull();
    expect(deriveRepoHealth(raw(), NOW).lastCommitAt).toBe("2024-01-01T00:00:00Z");
  });

  it("derives hasReadme and ci status", () => {
    expect(deriveRepoHealth(raw({ readme: "" }), NOW).hasReadme).toBe(false);
    expect(deriveRepoHealth(raw({ readme: null }), NOW).hasReadme).toBe(false);
    expect(deriveRepoHealth(raw(), NOW).hasReadme).toBe(true);
    expect(deriveRepoHealth(raw({ checks: null }), NOW).ciStatus).toBe("none");
    expect(deriveRepoHealth(raw(), NOW).ciStatus).toBe("failing");
  });
});
