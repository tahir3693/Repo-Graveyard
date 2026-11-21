import { describe, expect, it } from "vitest";
import {
  IssueRequestSchema,
  ResurrectRequestSchema,
  isAllowedOrigin,
  isJsonContentType,
  readBodyLimited,
} from "./request";

function stream(...chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

describe("request schemas", () => {
  it("strips owner and other unknown keys", () => {
    const r = ResurrectRequestSchema.parse({ repo: "a", owner: "x", username: "y", labels: [] });
    expect(r).toEqual({ repo: "a" });
    const i = IssueRequestSchema.parse({ repo: "a", title: "t", body: "b", owner: "x", labels: [] });
    expect(i).toEqual({ repo: "a", title: "t", body: "b" });
  });

  it("rejects non-boolean demo and dot names", () => {
    expect(ResurrectRequestSchema.safeParse({ repo: "a", demo: "true" }).success).toBe(false);
    expect(ResurrectRequestSchema.safeParse({ repo: "." }).success).toBe(false);
    expect(ResurrectRequestSchema.safeParse({ repo: ".." }).success).toBe(false);
    expect(ResurrectRequestSchema.safeParse({ repo: "a/b" }).success).toBe(false);
  });

  it("rejects multi-line titles", () => {
    expect(IssueRequestSchema.safeParse({ repo: "a", title: "x\ny", body: "b" }).success).toBe(false);
  });
});

describe("isAllowedOrigin", () => {
  it("allows absent and exact matches only", () => {
    expect(isAllowedOrigin(null, ["https://a.test"])).toBe(true);
    expect(isAllowedOrigin("https://a.test", ["https://a.test"])).toBe(true);
    expect(isAllowedOrigin("null", ["https://a.test"])).toBe(false);
    expect(isAllowedOrigin("https://A.test", ["https://a.test"])).toBe(false);
  });
});

describe("isJsonContentType", () => {
  it("accepts charset and rejects others", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("Application/JSON; charset=utf-8")).toBe(true);
    expect(isJsonContentType("text/plain")).toBe(false);
    expect(isJsonContentType(null)).toBe(false);
  });
});

describe("readBodyLimited", () => {
  it("accepts exactly the limit and rejects one over", async () => {
    expect(await readBodyLimited(stream(new Uint8Array(20_000).fill(97)), 20_000)).toMatchObject({
      ok: true,
    });
    expect(await readBodyLimited(stream(new Uint8Array(20_001).fill(97)), 20_000)).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("returns empty text for a null body", async () => {
    expect(await readBodyLimited(null, 10)).toEqual({ ok: true, text: "" });
  });

  it("rejects invalid UTF-8", async () => {
    expect(await readBodyLimited(stream(new Uint8Array([0xff, 0xfe])), 10)).toEqual({
      ok: false,
      reason: "unreadable",
    });
  });
});
