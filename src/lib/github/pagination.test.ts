import { describe, expect, it, vi } from "vitest";
import {
  collectPages,
  PAGE_SIZE,
  parseHasNextPage,
  REPO_LIMIT,
  type RepoPage,
} from "./pagination";

function makePager(total: number) {
  const fetchPage = vi.fn(async (page: number): Promise<RepoPage> => {
    const start = (page - 1) * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, total);
    const items: number[] = [];
    for (let i = start; i < end; i += 1) items.push(i);
    return { items, hasNext: end < total };
  });
  return fetchPage;
}

describe("constants", () => {
  it("uses 100 per page and a 300 limit", () => {
    expect(PAGE_SIZE).toBe(100);
    expect(REPO_LIMIT).toBe(300);
  });
});

describe("parseHasNextPage", () => {
  it("detects rel=next among several links", () => {
    const header =
      '<https://api.github.com/user/repos?page=1>; rel="prev", <https://api.github.com/user/repos?page=3>; rel="next", <https://api.github.com/user/repos?page=9>; rel="last"';
    expect(parseHasNextPage(header)).toBe(true);
  });

  it("detects rel=next when it is the only link", () => {
    expect(parseHasNextPage('<https://api.github.com/x?page=2>; rel="next"')).toBe(true);
  });

  it("is false without rel=next", () => {
    const header =
      '<https://api.github.com/x?page=1>; rel="prev", <https://api.github.com/x?page=1>; rel="first"';
    expect(parseHasNextPage(header)).toBe(false);
  });

  it("is false for undefined and empty headers", () => {
    expect(parseHasNextPage(undefined)).toBe(false);
    expect(parseHasNextPage("")).toBe(false);
  });

  it("is false for a malformed header", () => {
    expect(parseHasNextPage("garbage;;; rel=")).toBe(false);
    expect(parseHasNextPage("next")).toBe(false);
    expect(parseHasNextPage('https://api.github.com/x; rel="next"')).toBe(false);
  });
});

describe("collectPages", () => {
  it("returns a single page with truncated false", async () => {
    const fetchPage = makePager(40);
    const result = await collectPages(fetchPage);
    expect(result.items).toHaveLength(40);
    expect(result.truncated).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list for an empty first page", async () => {
    const result = await collectPages(makePager(0));
    expect(result).toEqual({ items: [], truncated: false });
  });

  it("exactly 300 with no next page is not truncated", async () => {
    const fetchPage = makePager(300);
    const result = await collectPages(fetchPage);
    expect(result.items).toHaveLength(300);
    expect(result.truncated).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("301 items are truncated to 300 and no 4th page is fetched", async () => {
    const fetchPage = makePager(301);
    const result = await collectPages(fetchPage);
    expect(result.items).toHaveLength(300);
    expect(result.items[299]).toBe(299);
    expect(result.truncated).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("slices when a page overshoots the limit", async () => {
    const fetchPage = vi.fn(async (page: number): Promise<RepoPage> => ({
      items: Array.from({ length: 250 }, (_, i) => (page - 1) * 250 + i),
      hasNext: true,
    }));
    const result = await collectPages(fetchPage);
    expect(result.items).toHaveLength(300);
    expect(result.truncated).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("rejects without partial items when page 2 fails", async () => {
    const fetchPage = vi.fn(async (page: number): Promise<RepoPage> => {
      if (page === 2) throw new Error("boom");
      return { items: [1, 2, 3], hasNext: true };
    });
    await expect(collectPages(fetchPage)).rejects.toThrow("boom");
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
