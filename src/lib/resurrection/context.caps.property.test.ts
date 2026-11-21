import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { GitHubRepo } from "@/lib/github/schemas";
import { scoreRepo } from "@/lib/scoring";
import { capBundle, ContextBundleSchema, deriveRepoHealth, type RawContext } from "./context";
import { RESURRECTION_LIMITS as L } from "./limits";
import { codePointLength, sanitizeText } from "./text";

// Feature: resurrection, Property 2: Capped bundle respects every cap
// **Validates: Requirements 2.11, 2.12, 3.6, 3.9, 3.11**

const NOW = new Date("2025-06-01T00:00:00Z");

const piece = fc.oneof(
  fc.string({ maxLength: 12 }),
  fc.constantFrom('"', "\\", "\n", "\r\n", "\t", "\u0000", "\u202E", "😀", "\uD800", "a", "/"),
);
const text = (maxPieces: number) => fc.array(piece, { maxLength: maxPieces }).map((p) => p.join(""));
const bigText = fc.oneof(text(60), fc.constantFrom('"', "\\", "\n", "😀").chain((c) => fc.integer({ min: 0, max: 20_000 }).map((n) => c.repeat(n))));
const nullable = <T>(a: fc.Arbitrary<T>) => fc.option(a, { nil: null });

const repoArb: fc.Arbitrary<GitHubRepo> = fc.record({
  name: fc.stringMatching(/^[A-Za-z0-9._-]{1,200}$/),
  html_url: fc.constant("https://github.com/o/r"),
  description: nullable(text(80)),
  fork: fc.boolean(),
  archived: fc.boolean(),
  stargazers_count: fc.nat({ max: 100_000 }),
  open_issues_count: fc.nat({ max: 5_000 }),
  language: nullable(text(30)),
  pushed_at: nullable(fc.constant("2024-01-01T00:00:00Z")),
  default_branch: fc.constant("main"),
  owner: fc.record({ login: fc.constant("o") }),
});

const rawArb: fc.Arbitrary<RawContext> = fc.record({
  repo: repoArb,
  readme: nullable(bigText),
  tree: nullable(fc.array(fc.record({ path: text(30), type: fc.constantFrom("blob", "tree") }), { maxLength: 200 })),
  commits: nullable(
    fc.array(fc.record({ message: text(40), date: nullable(fc.constant("2024-02-01T00:00:00Z")) }), { maxLength: 200 }),
  ),
  checks: nullable(
    fc.array(
      fc.record({ name: text(40), conclusion: nullable(fc.constantFrom("success", "failure", "timed_out", "startup_failure", "neutral")) }),
      { maxLength: 200 },
    ),
  ),
  issues: nullable(fc.array(fc.record({ title: text(40) }), { maxLength: 200 })),
  outdatedDeps: nullable(fc.boolean()),
});

describe("Feature: resurrection, Property 2: Capped bundle respects every cap", () => {
  it("passes the schema, honors every cap and the serialized limit", () => {
    fc.assert(
      fc.property(rawArb, (raw) => {
        const health = deriveRepoHealth(raw, NOW);
        const b = capBundle(raw, scoreRepo(health, NOW), health);
        expect(ContextBundleSchema.safeParse(b).success).toBe(true);
        expect(codePointLength(b.name)).toBeLessThanOrEqual(L.CAP_NAME);
        expect(codePointLength(b.description ?? "")).toBeLessThanOrEqual(L.CAP_DESCRIPTION);
        expect(codePointLength(b.language ?? "")).toBeLessThanOrEqual(L.CAP_LANGUAGE);
        expect(codePointLength(b.readme)).toBeLessThanOrEqual(L.CAP_README);
        expect(b.fileTree.length).toBeLessThanOrEqual(L.CAP_TREE_ENTRIES);
        expect(b.fileTree.every((e) => codePointLength(e) <= L.CAP_TREE_ENTRY)).toBe(true);
        expect(b.commitMessages.length).toBeLessThanOrEqual(L.CAP_COMMITS);
        expect(b.commitMessages.every((e) => codePointLength(e) <= L.CAP_COMMIT)).toBe(true);
        expect(b.ci.failingChecks.length).toBeLessThanOrEqual(L.CAP_FAILING_CHECKS);
        expect(b.ci.failingChecks.every((e) => codePointLength(e) <= L.CAP_CHECK_NAME)).toBe(true);
        expect(b.openIssueTitles.length).toBeLessThanOrEqual(L.CAP_ISSUE_TITLES);
        expect(b.openIssueTitles.every((e) => codePointLength(e) <= L.CAP_ISSUE_TITLE)).toBe(true);
        expect(JSON.stringify(b).length).toBeLessThanOrEqual(L.CAP_SERIALIZED);
        const longer = codePointLength(sanitizeText(raw.readme ?? "")) > L.CAP_README;
        expect(b.readmeTruncated).toBe(longer);
      }),
      { numRuns: 150 },
    );
  });
});
