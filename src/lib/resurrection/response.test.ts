import { describe, expect, it } from "vitest";
import { VALID_PLAN } from "./plan.fixtures";
import { IssueSuccessSchema, ResurrectSuccessSchema } from "./response";

const plan = VALID_PLAN;

describe("ResurrectSuccessSchema", () => {
  it("requires fallbackReason exactly when source is fallback", () => {
    expect(ResurrectSuccessSchema.safeParse({ source: "ai", plan }).success).toBe(true);
    expect(ResurrectSuccessSchema.safeParse({ source: "ai", plan, fallbackReason: "llm_timeout" }).success).toBe(
      false,
    );
    expect(ResurrectSuccessSchema.safeParse({ source: "fallback", plan }).success).toBe(false);
    expect(
      ResurrectSuccessSchema.safeParse({ source: "fallback", plan, fallbackReason: "llm_timeout" }).success,
    ).toBe(true);
  });

  it("rejects an unknown reason", () => {
    expect(ResurrectSuccessSchema.safeParse({ source: "fallback", plan, fallbackReason: "x" }).success).toBe(
      false,
    );
  });
});

describe("IssueSuccessSchema", () => {
  it("validates url and number", () => {
    expect(IssueSuccessSchema.safeParse({ issueUrl: "https://github.com/a/b/issues/1", number: 1 }).success).toBe(
      true,
    );
    expect(IssueSuccessSchema.safeParse({ issueUrl: "u", number: 0 }).success).toBe(false);
  });
});
