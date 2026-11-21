import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import type { AuthEnv } from "../env";
import { jwtCallback, sessionCallback } from "./callbacks";

/** Drops all log metadata so no token, secret or profile data is ever logged. */
const silentLogger: NonNullable<NextAuthOptions["logger"]> = {
  error: () => undefined,
  warn: () => undefined,
  debug: () => undefined,
};

export function createAuthOptions(env: AuthEnv): NextAuthOptions {
  return {
    providers: [
      GithubProvider({
        clientId: env.githubId,
        clientSecret: env.githubSecret,
        authorization: { params: { scope: "public_repo" } },
      }),
    ],
    session: { strategy: "jwt" },
    secret: env.authSecret,
    pages: { signIn: "/", error: "/" },
    callbacks: { jwt: jwtCallback, session: sessionCallback },
    logger: silentLogger,
  };
}
