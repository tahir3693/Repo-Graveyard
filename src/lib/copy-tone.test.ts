import { describe, expect, it } from "vitest";
import * as plan from "@/components/ResurrectPlan";
import { issueErrorText } from "@/components/ResurrectArea";
import * as auth from "@/lib/auth/error-messages";
import { BANNED_WORDS } from "@/lib/epitaphs";
import { graveyardErrorCopy } from "@/lib/graveyard/error-copy";

// "you" and "your" address the reader in plain UI text, so only the blame words apply here.
const BLAME_WORDS = BANNED_WORDS.filter((word) => !word.startsWith("you"));

function blames(text: string): boolean {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.some((word) => BLAME_WORDS.includes(word));
}

const ISSUE_CODES = [
  "unauthenticated",
  "token_revoked",
  "not_repo_owner",
  "repo_archived",
  "issues_disabled",
  "issue_rate_limited",
  "rate_limited",
  "issue_result_unknown",
  "github_unavailable",
  "internal_error",
] as const;

describe("user-facing copy tone", () => {
  it("keeps blame words out of the sign-in messages", () => {
    const messages: string[] = [];
    for (const value of Object.values(auth)) if (typeof value === "string") messages.push(value);
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) expect(blames(message)).toBe(false);
    for (const code of ["AccessDenied", "Configuration", "Callback", "Other"]) {
      expect(blames(auth.authErrorMessage(code))).toBe(false);
    }
  });

  it("keeps blame words out of the graveyard error copy", () => {
    for (const code of [null, "rate_limited", "github_unavailable", "unauthorized", "auth_not_configured", "demo_unavailable"]) {
      const copy = graveyardErrorCopy(code);
      expect(blames(`${copy.title} ${copy.text}`)).toBe(false);
    }
  });

  it("keeps blame words out of the issue error text", () => {
    for (const code of ISSUE_CODES) expect(blames(issueErrorText(code, 5))).toBe(false);
  });

  it("keeps blame words out of the plan notes", () => {
    const notes = [
      plan.FALLBACK_PLAN_NOTE,
      plan.AI_PLAN_NOTE,
      plan.LABELS_NOTE,
      plan.DEMO_ISSUE_NOTE,
      plan.FILED_MESSAGE,
      plan.COPIED_MESSAGE,
      plan.COPY_FAILED_MESSAGE,
      ...Object.values(plan.VERDICT_LABEL),
      ...Object.values(plan.EFFORT_LEVEL_LABEL),
    ];
    for (const note of notes) expect(blames(note)).toBe(false);
  });

  it("never claims the AI wrote the fallback plan", () => {
    expect(plan.FALLBACK_PLAN_NOTE).toBe("Rule-based plan (the AI was unavailable)");
  });
});
