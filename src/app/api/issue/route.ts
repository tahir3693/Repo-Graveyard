import { handleIssue } from "@/lib/resurrection/handle-issue";
import { createIssueDeps } from "@/lib/resurrection/issue-deps";

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  return handleIssue(createIssueDeps(process.env), req);
}
