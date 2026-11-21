import { getToken } from "next-auth/jwt";
import type { GetTokenParams } from "next-auth/jwt";
import { z } from "zod";
import { readAuthEnv } from "../env";

export type UserToken = { login: string; accessToken: string };
export type TokenRequest = GetTokenParams["req"];

const UserTokenSchema = z.object({
  login: z.string().min(1),
  accessToken: z.string().min(1),
});

/**
 * Server only. Reads the GitHub login and access token from the encrypted
 * session cookie. Returns null when missing, invalid or not configured.
 */
export async function readUserToken(
  req: TokenRequest,
  secret: string | undefined = readAuthEnv(process.env)?.authSecret,
): Promise<UserToken | null> {
  if (!secret) return null;
  try {
    const decoded = await getToken({ req, secret });
    const parsed = UserTokenSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
