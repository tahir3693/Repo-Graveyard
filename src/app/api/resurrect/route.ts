import { createResurrectionDeps } from "@/lib/resurrection/deps";
import { handleResurrect } from "@/lib/resurrection/handle-resurrect";

export const maxDuration = 70;

export async function POST(req: Request): Promise<Response> {
  return handleResurrect(createResurrectionDeps(process.env), req);
}
