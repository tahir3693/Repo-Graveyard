import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseIssueBody } from "./issue-body";

describe("parseIssueBody", () => {
  it("separates an intro from a task list", () => {
    expect(parseIssueBody("Intro line.\n\nRoadmap:\n\n- [ ] One (15 min): do it\n- [x] Two\n* [ ] Three")).toEqual([
      { kind: "text", text: "Intro line." },
      { kind: "text", text: "Roadmap:" },
      {
        kind: "tasks",
        items: [
          { done: false, text: "One (15 min): do it" },
          { done: true, text: "Two" },
          { done: false, text: "Three" },
        ],
      },
    ]);
  });

  it("keeps a task list in one block and starts another after text", () => {
    const blocks = parseIssueBody("- [ ] a\n- [ ] b\nmiddle\n- [ ] c");
    expect(blocks.map((b) => b.kind)).toEqual(["tasks", "text", "tasks"]);
  });

  it("treats a box without text, or without a space, as plain text", () => {
    expect(parseIssueBody("- [ ]")).toEqual([{ kind: "text", text: "- [ ]" }]);
    expect(parseIssueBody("-[ ] x")).toEqual([{ kind: "text", text: "-[ ] x" }]);
  });

  it("handles empty input and Windows line breaks", () => {
    expect(parseIssueBody("")).toEqual([]);
    expect(parseIssueBody("a\r\n- [ ] b")).toEqual([
      { kind: "text", text: "a" },
      { kind: "tasks", items: [{ done: false, text: "b" }] },
    ]);
  });

  it("never throws, never returns empty text, and loses no task item", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 300 }), (body) => {
        const blocks = parseIssueBody(body);
        for (const block of blocks) {
          if (block.kind === "text") expect(block.text.trim()).not.toBe("");
          else expect(block.items.length).toBeGreaterThan(0);
        }
        const tasks = blocks.flatMap((b) => (b.kind === "tasks" ? b.items : []));
        const expected = body.split(/\r\n|\r|\n/).filter((l) => /^[ \t]*[-*] \[[ xX]\][ \t]+\S/.test(l)).length;
        expect(tasks).toHaveLength(expected);
      }),
      { numRuns: 200 },
    );
  });
});
