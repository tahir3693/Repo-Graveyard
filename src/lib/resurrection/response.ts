import { z } from "zod";
import { RevivalPlanSchema } from "./plan";

export const FALLBACK_REASONS = [
  "llm_not_configured",
  "llm_timeout",
  "llm_unavailable",
  "llm_invalid_output",
] as const;

export const FallbackReasonSchema = z.enum(FALLBACK_REASONS);

export type FallbackReason = z.infer<typeof FallbackReasonSchema>;

export const ResurrectSuccessSchema = z
  .object({
    source: z.enum(["ai", "fallback"]),
    plan: RevivalPlanSchema,
    fallbackReason: FallbackReasonSchema.optional(),
  })
  .refine((value) => (value.source === "fallback") === (value.fallbackReason !== undefined), {
    message: "fallbackReason must be present exactly when source is fallback",
  });

export type ResurrectSuccess = z.infer<typeof ResurrectSuccessSchema>;

export const IssueSuccessSchema = z.object({
  issueUrl: z.string().min(1),
  number: z.number().int().positive(),
});

export type IssueSuccess = z.infer<typeof IssueSuccessSchema>;
