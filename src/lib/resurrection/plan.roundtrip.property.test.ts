import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EFFORTS, parsePlan, sanitizePlanText, type RevivalPlan } from "./plan";

// Feature: resurrection, Property 6: Plan round trip, with and without a code fence
// **Validates: Requirements 6.6, 6.8, 6.12**

const safeChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;-_()[]{}*#/\"'?!%&+=~é😀";
const safeText = (min: number, max: number) =>
  fc
    .array(fc.constantFrom(...Array.from(safeChars)), { minLength: min, maxLength: max })
    .map((chars) => chars.join(""))
    .filter((s) => s.trim().length > 0 && sanitizePlanText(s) === s);

const validPlan: fc.Arbitrary<RevivalPlan> = fc.record({
  diagnosis: safeText(1, 80),
  smallestNextStep: safeText(1, 80),
  effort: fc.constantFrom(...EFFORTS),
  issueTitle: safeText(1, 60),
  issueBody: fc.tuple(safeText(1, 40), safeText(1, 40)).map(([a, b]) => `${a}\n${b}`),
});

describe("Feature: resurrection, Property 6: Plan round trip, with and without a code fence", () => {
  it("returns the same plan bare, fenced and surrounded by whitespace", () => {
    fc.assert(
      fc.property(validPlan, fc.constantFrom("json", "JSON", "", "ts"), fc.constantFrom("", " ", "\n\n", "\t \n"), (plan, lang, ws) => {
        const json = JSON.stringify(plan);
        const variants = [json, `${ws}${json}${ws}`, `\`\`\`${lang}\n${json}\n\`\`\``, `${ws}\`\`\`${lang}\n${json}\n\`\`\`${ws}`];
        for (const text of variants) {
          expect(parsePlan(text)).toEqual({ ok: true, plan });
        }
      }),
      { numRuns: 150 },
    );
  });
});
