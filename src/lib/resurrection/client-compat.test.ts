import { describe, expect, it } from "vitest";
import { ResurrectResponseSchema } from "@/lib/graveyard/client";
import { buildFallbackPlan } from "./fallback";
import { ResurrectSuccessSchema } from "./response";

const plan = buildFallbackPlan({ name: "todo-app", causeCode: "archived", status: "dead" });

describe("ResurrectSuccessSchema bodies vs the browser client schema", () => {
  it("accepts a source ai body", () => {
    const body = ResurrectSuccessSchema.parse({ source: "ai", plan });
    expect(ResurrectResponseSchema.safeParse(JSON.parse(JSON.stringify(body))).success).toBe(true);
  });

  it("accepts a source fallback body with a reason", () => {
    const body = ResurrectSuccessSchema.parse({
      source: "fallback",
      plan,
      fallbackReason: "llm_timeout",
    });
    expect(ResurrectResponseSchema.safeParse(JSON.parse(JSON.stringify(body))).success).toBe(true);
  });
});
