import { getToken } from "next-auth/jwt";
import type { GetTokenParams } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { z } from "zod";
import { readAuthEnv, type EnvRecord } from "../env";
import { cookieNamesOf, sessionCookieNames } from "./session-cookies";

export type UserToken = { login: string; accessToken: string };
export type TokenRequest = GetTokenParams["req"];

const UserTokenSchema = z.object({
  login: z.string().min(1),
  accessToken: z.string().min(1),
});

/**
 * Server only. Reads the GitHub login and access token from the encrypted
 * session cookie. Returns null when missing, invalid or not configured.
 * `secureCookie` picks the cookie name (`__Secure-` prefix or not). When it is left out,
 * next-auth guesses from NEXTAUTH_URL.
 */
export async function readUserToken(
  req: TokenRequest,
  secret: string | undefined = readAuthEnv(process.env)?.authSecret,
  secureCookie?: boolean,
): Promise<UserToken | null> {
  if (!secret) return null;
  try {
    const decoded = await getToken(
      secureCookie === undefined ? { req, secret } : { req, secret, secureCookie },
    );
    const parsed = UserTokenSchema.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const SECURE_COOKIE_PREFIX = "__Secure-";

/**
 * Server only. The one place a route turns its `Request` into a signed-in user, shared by the
 * scan, resurrect and issue routes. It never throws: every failure is "not signed in" (null).
 *
 * - The secret is the one the auth config signs with (`AUTH_SECRET` through `readAuthEnv`).
 * - The token request is built from the URL and headers only. The route has usually read the
 *   body already, and `new Request(usedRequest)` throws "Cannot construct a Request with a
 *   Request object that has already been used".
 * - The cookie name comes from what the browser sent: a `__Secure-` session cookie means the
 *   session was set over https. That stays right whatever NEXTAUTH_URL says.
 */
export async function readUserTokenFromRequest(
  req: Request,
  env: EnvRecord,
): Promise<UserToken | null> {
  const secret = readAuthEnv(env)?.authSecret;
  if (secret === undefined) return null;
  try {
    const names = sessionCookieNames(cookieNamesOf(req.headers.get("cookie")));
    if (names.length === 0) return null;
    const secureCookie = names.some((name) => name.startsWith(SECURE_COOKIE_PREFIX));
    const tokenRequest = new NextRequest(req.url, { headers: req.headers });
    return await readUserToken(tokenRequest, secret, secureCookie);
  } catch {
    return null;
  }
}