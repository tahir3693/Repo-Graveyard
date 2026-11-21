import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isExpectedIssueUrl } from "./issue";

const segment = fc.stringMatching(/^[A-Za-z0-9._-]{1,20}$/);
const num = fc.integer({ min: 1, max: 1_000_000 });
const caseMix = (text: string, flips: boolean[]) =>
  [...text].map((c, i) => (flips[i % flips.length] ? c.toUpperCase() : c.toLowerCase())).join("");

describe("Feature: resurrection, Property 20: Issue URL check accepts exactly the expected URL", () => {
  it("accepts the expected URL in any letter case", () => {
    fc.assert(
      fc.property(segment, segment, num, fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }), (login, repo, n, flips) => {
        const url = caseMix(`https://github.com/${login}/${repo}/issues/${n}`, flips);
        expect(isExpectedIssueUrl(url, login, repo, n)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("rejects any deviation from the expected URL", () => {
    const deviations: Array<(base: string, n: number) => string> = [
      (b) => b.replace("https://", "http://"),
      (b) => b.replace("github.com", "github.com.evil.io"),
      (b) => b.replace("github.com", "github.com:8443"),
      (b) => b.replace("https://", "https://user:pw@"),
      (b) => `${b}?x=1`,
      (b) => `${b}#frag`,
      (b) => `${b}/`,
      (b) => b.replace("github.com/", "github.com/prefix/"),
      (b, n) => b.replace(/\d+$/, String(n + 1)),
    ];
    fc.assert(
      fc.property(segment, segment, num, fc.integer({ min: 0, max: deviations.length - 1 }), (login, repo, n, i) => {
        const base = `https://github.com/${login}/${repo}/issues/${n}`;
        expect(isExpectedIssueUrl(deviations[i](base, n), login, repo, n)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
