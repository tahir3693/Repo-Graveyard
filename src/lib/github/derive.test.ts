import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveCiStatus, deriveOutdatedDeps } from "./derive";

const NOW = new Date("2025-01-01T00:00:00.000Z");
const DAY = 86_400_000;

describe("deriveCiStatus", () => {
  it("returns none for no check runs", () => {
    expect(deriveCiStatus([])).toBe("none");
  });

  it("returns failing when any check run failed", () => {
    expect(deriveCiStatus(["success", "failure"])).toBe("failing");
    expect(deriveCiStatus(["timed_out"])).toBe("failing");
    expect(deriveCiStatus(["startup_failure"])).toBe("failing");
  });

  it("returns passing when none failed and null (running) is not a failure", () => {
    expect(deriveCiStatus(["success", "skipped", null])).toBe("passing");
    expect(deriveCiStatus([null])).toBe("passing");
  });

  it("is failing whenever a failing conclusion is present (property)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.constantFrom("success", "neutral", "skipped", "cancelled"), { nil: null })),
        fc.constantFrom("failure", "timed_out", "startup_failure"),
        fc.nat(10),
        (others, bad, at) => {
          const list: Array<string | null> = [...others];
          list.splice(Math.min(at, list.length), 0, bad);
          return deriveCiStatus(list) === "failing";
        },
      ),
    );
  });
});

describe("deriveOutdatedDeps", () => {
  it("returns null for a missing date", () => {
    expect(deriveOutdatedDeps(null, NOW)).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(deriveOutdatedDeps("not a date", NOW)).toBeNull();
    expect(deriveOutdatedDeps("", NOW)).toBeNull();
  });

  it("is false at exactly 365 days and true one millisecond later", () => {
    const exact = new Date(NOW.getTime() - 365 * DAY).toISOString();
    const over = new Date(NOW.getTime() - 365 * DAY - 1).toISOString();
    expect(deriveOutdatedDeps(exact, NOW)).toBe(false);
    expect(deriveOutdatedDeps(over, NOW)).toBe(true);
  });

  it("is false for a future date", () => {
    expect(deriveOutdatedDeps(new Date(NOW.getTime() + 30 * DAY).toISOString(), NOW)).toBe(false);
  });

  it("is deterministic for the same input (property)", () => {
    fc.assert(
      fc.property(fc.date({ noInvalidDate: true }), (d) => {
        const iso = d.toISOString();
        return deriveOutdatedDeps(iso, NOW) === deriveOutdatedDeps(iso, NOW);
      }),
    );
  });
});
