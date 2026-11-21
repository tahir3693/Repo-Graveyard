import type { Account, Profile, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { z } from "zod";

const AccountSchema = z.object({ access_token: z.string().min(1) });
const GitHubProfileSchema = z.object({
  login: z.string().min(1),
  avatar_url: z.url(),
});

type JwtParams = {
  token: JWT;
  account?: Account | null;
  profile?: Profile;
};

type SessionParams = {
  session: Session;
  token: JWT;
};

/**
 * On first sign-in (account and profile present) copies the validated access
 * token, login and avatar URL into the JWT. Later calls return the token as is.
 * Invalid data on first sign-in stores no token.
 */
export function jwtCallback({ token, account, profile }: JwtParams): JWT {
  if (!account || !profile) return token;

  const parsedAccount = AccountSchema.safeParse(account);
  const parsedProfile = GitHubProfileSchema.safeParse(profile);
  if (!parsedAccount.success || !parsedProfile.success) {
    return { ...token, accessToken: undefined, login: undefined, avatarUrl: undefined };
  }

  return {
    ...token,
    accessToken: parsedAccount.data.access_token,
    login: parsedProfile.data.login,
    avatarUrl: parsedProfile.data.avatar_url,
  };
}

/**
 * Builds the client-visible session from login, avatar and expiry only.
 * Never copies the access token or any other token field.
 */
export function sessionCallback({ session, token }: SessionParams): Session {
  if (!token.login) return { expires: session.expires };
  return {
    expires: session.expires,
    user: { login: token.login, image: token.avatarUrl ?? null },
  };
}
