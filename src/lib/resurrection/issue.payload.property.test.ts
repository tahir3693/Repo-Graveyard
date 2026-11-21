import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { IssueWriter } from "@/lib/github/issue-writer";
import { createIssue, ISSUE_FOOTER, prepareIssue } from "./issue";
import { sanitizePlanText } from "./plan";

const NOW = new Date("2025-01-01T00:00:00Z");
const name = fc.stringMatching(/^[A-Za-z0-9._-]{1,20}$/).filter((v) => v !== "." && v !== "..");
const noise = fc.oneof(
  fc.string({ unit: "grapheme", minLength: 1, maxLength: 80 }),
  fc.constantFrom("<b>hi</b>", "@alice hi", "![x](y)", "`@z`", "a\u202Eb"),
);

describe("Feature: resurrection, Property 19: Issue payload is exact", () => {
  it("sends one POST with sanitized title, body plus footer, and only four params", async () => {
    await fc.assert(
      fc.asyncProperty(name, name, noise, noise, async (login, repo, rawTitle, rawBody) => {
        const title = rawTitle.replace(/[\r\n]/g, " ");
        const prepared = prepareIssue(title, rawBody);
        fc.pre(prepared.ok);
        if (!prepared.ok) return;
        const calls: Array<{ route: string; params: Record<string, unknown> }> = [];
        const writer: IssueWriter = async (route, params) => {
          calls.push({ route, params });
          return {
            status: 201,
            headers: {},
            data: { number: 1, html_url: `https://github.com/${login}/${repo}/issues/1` },
          };
        };
        await createIssue(writer, { login, repo, title: prepared.title, body: prepared.body, now: NOW });
        expect(calls).toHaveLength(1);
        expect(calls[0].route).toBe("POST /repos/{owner}/{repo}/issues");
        expect(Object.keys(calls[0].params).sort()).toEqual(["body", "owner", "repo", "title"]);
        expect(calls[0].params.owner).toBe(login);
        expect(calls[0].params.repo).toBe(repo);
        expect(calls[0].params.title).toBe(sanitizePlanText(title));
        expect(calls[0].params.body).toBe(`${sanitizePlanText(rawBody)}\n\n${ISSUE_FOOTER}`);
      }),
      { numRuns: 100 },
    );
  });
});
