import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { LlmResult } from "@/lib/llm";
import { runAttempts } from "./attempts";

const VALID = JSON.stringify({
  diagnosis: "Paused.",
  smallestNextStep: "Run it.",
  effort: "a weekend",
  issueTitle: "Revive it",
  issueBody: "- [ ] go",
});

type Step = "valid" | "invalid" | "timeout" | "reject";
const stepArb = fc.constantFrom<Step>("valid", "invalid", "timeout", "reject");

function kindOf(step: Step) {
  return step === "invalid" ? "invalid_output" : step === "timeout" ? "timeout" : "unavailable";
}

describe("Feature: resurrection, Property 10: Retry orchestration", () => {
  /** **Validates: Requirements 4.9, 7.1, 7.2, 7.3, 7.4** */
  it("holds for any two-result sequence", async () => {
    await fc.assert(
      fc.asyncProperty(fc.tuple(stepArb, stepArb), async ([a, b]) => {
        const steps = [a, b];
        let calls = 0;
        const request = Object.freeze({ system: "s", user: "u" });
        const seen: unknown[] = [];
        const call = async (): Promise<LlmResult> => {
          seen.push(request);
          const step = steps[calls];
          calls += 1;
          if (step === "reject") throw new Error("x");
          if (step === "timeout") return { ok: false, kind: "timeout" };
          return { ok: true, text: step === "valid" ? VALID : "garbage" };
        };
        const result = await runAttempts(call, 2);
        expect(calls).toBe(a === "valid" ? 1 : 2);
        expect(result.ok).toBe(a === "valid" || b === "valid");
        if (!result.ok) expect(result.lastKind).toBe(kindOf(b));
        expect(new Set(seen).size).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});
