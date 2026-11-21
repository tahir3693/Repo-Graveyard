import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { filterForks } from "./forks";

type R = { name: string; fork: boolean; archived: boolean };
const repos: R[] = [
  { name: "a", fork: false, archived: false },
  { name: "b", fork: true, archived: false },
  { name: "c", fork: false, archived: true },
  { name: "d", fork: true, archived: true },
];

describe("filterForks", () => {
  it("removes forks and keeps archived non-forks", () => {
    const { kept } = filterForks(repos, false);
    expect(kept.map((r) => r.name)).toEqual(["a", "c"]);
  });

  it("counts an archived fork exactly once", () => {
    expect(filterForks([repos[3]], false)).toEqual({ kept: [], skippedForks: 1 });
    expect(filterForks(repos, false).skippedForks).toBe(2);
  });

  it("keeps everything and skips none when includeForks is true", () => {
    const result = filterForks(repos, true);
    expect(result.kept).toEqual(repos);
    expect(result.skippedForks).toBe(0);
  });

  it("does not mutate the input", () => {
    const copy = [...repos];
    filterForks(repos, false);
    expect(repos).toEqual(copy);
  });

  it("kept + skipped equals the input size (property)", () => {
    fc.assert(
      fc.property(fc.array(fc.record({ fork: fc.boolean(), archived: fc.boolean() })), fc.boolean(), (list, inc) => {
        const { kept, skippedForks } = filterForks(list, inc);
        return kept.length + skippedForks === list.length;
      }),
    );
  });
});
