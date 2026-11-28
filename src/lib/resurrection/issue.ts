/**
 * Issue preparation and creation. The only write the app performs is one
 * `POST /repos/{owner}/{repo}/issues`, sent through an injected, narrow writer.
 * Results never carry the token or any upstream (GitHub) text.
 */
import { z } from "zod";
import type { IssueWriter } from "@/lib/github/issue-writer";
import { RESURRECTION_LIMITS } from "./limits";
import { mapGitHubFailure, type RouteFailure } from "./errors";
import { IssueCreatedSchema } from "./github-schemas";
import { boundedText, cleanModelText } from "./plan";

export const ISSUE_FOOTER = "Drafted by Repo Graveyard. This repo is only paused.";

const TitleSchema = boundedText(1, RESURRECTION_LIMITS.PLAN_TITLE_MAX).refine(
  (value) => !/[\r\n]/.test(value),
);
const BodySchema = boundedText(1, RESURRECTION_LIMITS.PLAN_BODY_MAX);

export type PreparedIssue = { ok: true; title: string; body: string } | { ok: false };

export function prepareIssue(title: string, body: string): PreparedIssue {
  if (typeof title !== "string" || typeof body !== "string") return { ok: false };
  // Same cleaning as model output: no HTML, images, mentions or links reach GitHub.
  const cleanTitle = cleanModelText(title);
  const cleanBody = cleanModelText(body);
  if (!TitleSchema.safeParse(cleanTitle).success) return { ok: false };
  if (!BodySchema.safeParse(cleanBody).success) return { ok: false };
  return { ok: true, title: cleanTitle, body: `${cleanBody}\n\n${ISSUE_FOOTER}` };
}

export function isExpectedIssueUrl(
  htmlUrl: string,
  login: string,
  repo: string,
  issueNumber: number,
): boolean {
  const expected = `https://github.com/${login}/${repo}/issues/${issueNumber}`;
  return htmlUrl.toLowerCase() === expected.toLowerCase();
}

export type CreateIssueArgs = {
  login: string;
  repo: string;
  title: string;
  body: string;
  now: Date;
};

export type CreateIssueResult =
  | { ok: true; issueUrl: string; number: number }
  | { ok: false; failure: RouteFailure };

const ErrorStatusSchema = z.object({ status: z.number() });

function failureFor(error: unknown, now: Date): RouteFailure {
  const status = ErrorStatusSchema.safeParse(error);
  if (status.success) {
    if (status.data.status === 410) return { code: "issues_disabled" };
    if (status.data.status === 422) return { code: "issue_rejected" };
    if (status.data.status === 404) return { code: "repo_not_found" };
  }
  return mapGitHubFailure(error, { now, mode: "user", phase: "issue-create" });
}

export async function createIssue(
  writer: IssueWriter,
  args: CreateIssueArgs,
): Promise<CreateIssueResult> {
  let data: unknown;
  try {
    const response = await writer("POST /repos/{owner}/{repo}/issues", {
      owner: args.login,
      repo: args.repo,
      title: args.title,
      body: args.body,
    });
    data = response.data;
  } catch (error) {
    return { ok: false, failure: failureFor(error, args.now) };
  }
  const parsed = IssueCreatedSchema.safeParse(data);
  if (
    !parsed.success ||
    !isExpectedIssueUrl(parsed.data.html_url, args.login, args.repo, parsed.data.number)
  ) {
    return { ok: false, failure: { code: "issue_result_unknown" } };
  }
  return { ok: true, issueUrl: parsed.data.html_url, number: parsed.data.number };
}
