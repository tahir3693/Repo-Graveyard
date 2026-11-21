import { z } from "zod";

export const ScanRequestSchema = z.object({
  demo: z.boolean().optional(),
  includeForks: z.boolean().optional(),
});

export type ScanRequest = { demo: boolean; includeForks: boolean };

export function parseScanRequest(raw: unknown): ScanRequest | null {
  const result = ScanRequestSchema.safeParse(raw);
  if (!result.success) return null;
  return {
    demo: result.data.demo ?? false,
    includeForks: result.data.includeForks ?? false,
  };
}
