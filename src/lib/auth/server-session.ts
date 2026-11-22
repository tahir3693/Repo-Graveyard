import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { readAuthEnv, type EnvRecord } from "../env";
import { createAuthOptions } from "./options";

/** The only session fields pages may see. Never includes the access token. */
export type SessionUser = { login: string; image: string | null };

const SessionUserSchema = z.object({
  user: z.object({
    login: z.string().min(1),
    image: z.string().nullish(),
  }),
});

/** Pure: picks login and image from a client-safe session, or returns null. */
export function toSessionUser(session: unknown): SessionUser | null {
  const parsed = SessionUserSchema.safeParse(session);
  if (!parsed.success) return null;
  return { login: parsed.data.user.login, image: parsed.data.user.image ?? null };
}

/**
 * Server only. Reads the signed-in user from the encrypted session cookie.
 * Returns null when signed out, not configured, or the cookie is invalid.
 */
export async function readSessionUser(env: EnvRecord): Promise<SessionUser | null> {
  const authEnv = readAuthEnv(env);
  if (authEnv === null) return null;
  try {
    return toSessionUser(await getServerSession(createAuthOptions(authEnv)));
  } catch {
    return null;
  }
}
