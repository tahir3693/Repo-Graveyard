import { describe, expect, it } from "vitest";
import { DETAIL_CONCURRENCY, mapWithConcurrency } from "./concurrency";

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mapWithConcurrency", () => {
  it("uses a detail concurrency of 5", () => {
    expect(DETAIL_CONCURRENCY).toBe(5);
  });

  it("returns an empty array for empty input without calling fn", async () => {
    let calls = 0;
    const result = await mapWithConcurrency([], 5, async () => {
      calls++;
      return 1;
    });
    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });

  it("preserves input order even when later items finish first", async () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7];
    const result = await mapWithConcurrency(items, 3, async (item) => {
      for (let i = 0; i < (items.length - item) % 4; i++) await tick();
      return item * 10;
    });
    expect(result).toEqual(items.map((n) => n * 10));
  });

  it("never exceeds the limit and calls fn once per item", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapWithConcurrency(items, 5, async () => {
      calls++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await tick();
      inFlight--;
    });
    expect(maxInFlight).toBe(5);
    expect(calls).toBe(20);
  });

  it("rejects with the first error and starts no new work", async () => {
    const started: number[] = [];
    const items = Array.from({ length: 10 }, (_, i) => i);
    const boom = new Error("boom");
    await expect(
      mapWithConcurrency(items, 2, async (item) => {
        started.push(item);
        await tick();
        if (item === 1) throw boom;
        return item;
      }),
    ).rejects.toBe(boom);
    await tick();
    await tick();
    expect(started.length).toBeLessThan(items.length);
    expect(Math.max(...started)).toBeLessThanOrEqual(3);
  });
});
