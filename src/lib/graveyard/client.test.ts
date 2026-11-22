import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  GraveyardRequestError,
  resurrectRepo,
  scanRepos,
  type FetchLike,
} from "@/lib/graveyard/client";

const REPO = {
  name: "todo-app",
  url: "https://github.com/demo-user/todo-app",
  description: null,
  lastCommitAt: "2026-05-01T12:00:00Z",
  openIssues: 4,
  archived: false,
  ciStatus: "failing",
  hasReadme: false,
  outdatedDeps: true,
  stars: 3,
  language: "TypeScript",
};

const SCAN = { mode: "demo", repos: [REPO], skippedForks: 0, skippedInvalid: 0, truncated: false };

const PLAN = {
  diagnosis: "Paused after the dependencies drifted.",
  smallestNextStep: "Bump the dependencies and run the tests.",
  effort: "a weekend",
  issueTitle: "Revive todo-app",
  issueBody: "Start with the lockfile.",
};

type Call = { url: string; init: RequestInit };

function fakeFetch(body: unknown, status = 200): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}

const sentBody = (call: Call): unknown => JSON.parse(String(call.init.body));

describe("scanRepos", () => {
  it("posts demo and includeForks false to /api/scan and returns the validated scan", async () => {
    const { fetch, calls } = fakeFetch(SCAN);
    const scan = await scanRepos({ demo: true }, fetch);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/scan");
    expect(calls[0].init.method).toBe("POST");
    expect(sentBody(calls[0])).toEqual({ demo: true, includeForks: false });
    expect(scan.repos[0].name).toBe("todo-app");
  });

  it("rejects a non-success response with a generic error", async () => {
    const { fetch } = fakeFetch({ error: { code: "unauthorized", message: "x" } }, 401);
    await expect(scanRepos({ demo: false }, fetch)).rejects.toMatchObject({ kind: "http" });
  });

  it("keeps only the typed error code from a failed response", async () => {
    const { fetch } = fakeFetch({ error: { code: "rate_limited", message: "secret upstream text" } }, 429);
    const error = await scanRepos({ demo: false }, fetch).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GraveyardRequestError);
    expect(error).toMatchObject({ kind: "http", code: "rate_limited" });
    expect(JSON.stringify(error)).not.toContain("secret upstream text");
  });

  it.each([{ error: { code: "Bad Code!" } }, { nope: true }, "text"])(
    "uses a null code when the error body is %j",
    async (body) => {
      const { fetch } = fakeFetch(body, 500);
      await expect(scanRepos({ demo: true }, fetch)).rejects.toMatchObject({ kind: "http", code: null });
    },
  );

  it("accepts the sampleData flag", async () => {
    const { fetch } = fakeFetch({ ...SCAN, sampleData: true });
    expect((await scanRepos({ demo: true }, fetch)).sampleData).toBe(true);
  });

  it("rejects a response that fails validation", async () => {
    const { fetch } = fakeFetch({ ...SCAN, repos: [{ ...REPO, openIssues: -1 }] });
    await expect(scanRepos({ demo: true }, fetch)).rejects.toMatchObject({ kind: "invalid" });
  });

  it("maps a network failure to a generic error", async () => {
    const failing: FetchLike = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(scanRepos({ demo: true }, failing)).rejects.toBeInstanceOf(GraveyardRequestError);
  });

  it("never resolves for arbitrary JSON that does not match the schema", async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (value) => {
        fc.pre(!(typeof value === "object" && value !== null && "repos" in value));
        const { fetch } = fakeFetch(value);
        await expect(scanRepos({ demo: true }, fetch)).rejects.toBeInstanceOf(
          GraveyardRequestError,
        );
      }),
      { numRuns: 200 },
    );
  });
});

describe("resurrectRepo", () => {
  it("sends only the repo name and the demo flag, never an owner", async () => {
    const { fetch, calls } = fakeFetch({ plan: PLAN, source: "ai" });
    const plan = await resurrectRepo("todo-app", { demo: true }, fetch);
    expect(calls[0].url).toBe("/api/resurrect");
    expect(sentBody(calls[0])).toEqual({ repo: "todo-app", demo: true });
    expect(plan).toEqual(PLAN);
  });

  it("omits demo outside demo mode", async () => {
    const { fetch, calls } = fakeFetch({ plan: PLAN, source: "fallback", fallbackReason: "llm_timeout" });
    await resurrectRepo("todo-app", { demo: false }, fetch);
    expect(sentBody(calls[0])).toEqual({ repo: "todo-app" });
  });

  it("refuses an owner/repo name without sending a request", async () => {
    const { fetch, calls } = fakeFetch({ plan: PLAN, source: "ai" });
    await expect(resurrectRepo("someone/todo-app", { demo: true }, fetch)).rejects.toMatchObject({
      kind: "invalid",
    });
    expect(calls).toHaveLength(0);
  });

  it("rejects a plan with an unknown effort or a blank field", async () => {
    for (const plan of [{ ...PLAN, effort: "soon" }, { ...PLAN, diagnosis: "   " }]) {
      const { fetch } = fakeFetch({ plan, source: "ai" });
      await expect(resurrectRepo("todo-app", { demo: true }, fetch)).rejects.toMatchObject({
        kind: "invalid",
      });
    }
  });

  it("for any valid repo name, the body has exactly repo and demo and no owner", async () => {
    const arbName = fc
      .stringMatching(/^[A-Za-z0-9._-]{1,100}$/)
      .filter((s) => s !== "." && s !== "..");
    await fc.assert(
      fc.asyncProperty(arbName, fc.boolean(), async (name, demo) => {
        const { fetch, calls } = fakeFetch({ plan: PLAN, source: "ai" });
        await resurrectRepo(name, { demo }, fetch);
        const body = sentBody(calls[0]);
        expect(body).toEqual(demo ? { repo: name, demo: true } : { repo: name });
        expect(body).not.toHaveProperty("owner");
      }),
      { numRuns: 200 },
    );
  });
});
