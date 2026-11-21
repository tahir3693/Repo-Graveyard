/**
 * Resurrection service. Reads GitHub (GET only, through the injected read-only
 * requester), scores, builds the prompt, asks the model, and returns a plan.
 * It takes no action based on plan content and logs nothing.
 */
import { callLlm, type LlmClient, type LlmRequest } from "@/lib/llm";
import { scoreRepo } from "@/lib/scoring";

import { runAttempts, toFallbackReason } from "./attempts";
import type { ResurrectionConfig } from "./config";
import { capBundle, deriveRepoHealth } from "./context";
import { buildFallbackPlan } from "./fallback";
import { gatherContext } from "./gather";
import { RESURRECTION_LIMITS } from "./limits";
import type { RevivalPlan } from "./plan";
import { buildPrompt } from "./prompt";
import type { ReadRequester } from "./read-only";
import type { FallbackReason } from "./response";

export type ResurrectOutcome =
  | { source: "ai"; plan: RevivalPlan }
  | { source: "fallback"; plan: RevivalPlan; fallbackReason: FallbackReason };

export type ResurrectServiceDeps = {
  request: ReadRequester;
  makeLlmClient: () => LlmClient | null;
  config: Pick<ResurrectionConfig, "llmTimeoutMs">;
  /** Known secret values (API key, tokens). A plan containing any of them is rejected. */
  secrets?: readonly string[];
};

export type ResurrectInput = { owner: string; repo: string; now: Date };

const MIN_SECRET_LENGTH = 8;

function planContainsSecret(plan: RevivalPlan, secrets: readonly string[]): boolean {
  const texts = [plan.diagnosis, plan.smallestNextStep, plan.effort, plan.issueTitle, plan.issueBody];
  return secrets.some(
    (secret) => secret.length >= MIN_SECRET_LENGTH && texts.some((text) => text.includes(secret)),
  );
}

export async function resurrect(
  deps: ResurrectServiceDeps,
  input: ResurrectInput,
): Promise<ResurrectOutcome> {
  const raw = await gatherContext({ request: deps.request, now: input.now }, input.owner, input.repo);
  const health = deriveRepoHealth(raw, input.now);
  const tombstone = scoreRepo(health, input.now);
  const bundle = capBundle(raw, tombstone, health);
  const prompt = buildPrompt(bundle);
  const fallback = () =>
    buildFallbackPlan({ name: bundle.name, causeCode: bundle.causeCode, status: bundle.status });

  const client = deps.makeLlmClient();
  if (client === null) {
    return { source: "fallback", plan: fallback(), fallbackReason: "llm_not_configured" };
  }

  // Built once: both attempts send the identical request.
  const request: LlmRequest = {
    system: prompt.system,
    user: prompt.user,
    maxOutputTokens: RESURRECTION_LIMITS.LLM_MAX_OUTPUT_TOKENS,
    temperature: RESURRECTION_LIMITS.LLM_TEMPERATURE,
  };
  const secrets = deps.secrets ?? [];
  const result = await runAttempts(
    () => callLlm(client, request, deps.config.llmTimeoutMs),
    RESURRECTION_LIMITS.LLM_MAX_ATTEMPTS,
    (plan) => !planContainsSecret(plan, secrets),
  );
  if (result.ok) return { source: "ai", plan: result.plan };
  return { source: "fallback", plan: fallback(), fallbackReason: toFallbackReason(result.lastKind) };
}
