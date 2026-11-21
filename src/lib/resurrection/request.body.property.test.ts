import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readBodyLimited } from "./request";

// Feature: resurrection, Property 16: Body size limit does not depend on chunking
// **Validates: Requirements 1.3, 10.2**

function streamOf(bytes: Uint8Array, cuts: number[]): ReadableStream<Uint8Array> {
  const points = [...new Set(cuts.map((c) => c % (bytes.length + 1)))].sort((a, b) => a - b);
  const chunks: Uint8Array[] = [];
  let prev = 0;
  for (const p of [...points, bytes.length]) {
    chunks.push(bytes.slice(prev, p));
    prev = p;
  }
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[i++];
      if (chunk === undefined) controller.close();
      else controller.enqueue(chunk);
    },
  });
}

describe("Feature: resurrection, Property 16: Body size limit does not depend on chunking", () => {
  it("returns too_large iff total bytes exceed the limit, else the original text", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 60 }),
        fc.array(fc.nat(500), { maxLength: 10 }),
        fc.integer({ min: 0, max: 200 }),
        async (text, cuts, maxBytes) => {
          const bytes = new TextEncoder().encode(text);
          const result = await readBodyLimited(streamOf(bytes, cuts), maxBytes);
          if (bytes.length > maxBytes) {
            expect(result).toEqual({ ok: false, reason: "too_large" });
          } else {
            expect(result).toEqual({ ok: true, text });
          }
        },
      ),
      { numRuns: 150 },
    );
  });
});
