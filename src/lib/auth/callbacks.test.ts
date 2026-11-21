import { describe, expect, it } from "vitest";
import type { Account, Profile } from "next-auth";
import { jwtCallback, sessionCallback } from "./callbacks";

const TOKEN = "gho_secretTokenValue123";
const account: Account = {
  provider: "github",
  type: "oauth",
  providerAccountId: "1",
  access_token: TOKEN,
};
const profile: Profile = { login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/1" } as Profile;

describe("jwtCallback", () => {
  it("stores token, login and avatar on first sign-in", () => {
    const jwt = jwtCallback({ token: {}, account, profile });
    expect(jwt).toMatchObject({
      accessToken: TOKEN,
      login: "octocat",
      avatarUrl: "https://avatars.githubusercontent.com/u/1",
    });
  });

  it("keeps the existing token on later calls", () => {
    const existing = { accessToken: TOKEN, login: "octocat", avatarUrl: "https://a.example/x" };
    expect(jwtCallback({ token: existing })).toEqual(existing);
  });

  it("stores no token when the account is invalid", () => {
    const bad: Account = { ...account, access_token: undefined };
    const jwt = jwtCallback({ token: {}, account: bad, profile });
    expect(jwt.accessToken).toBeUndefined();
  });

  it("stores no token when the profile is invalid", () => {
    const bad = { login: "", avatar_url: "not a url" } as Profile;
    const jwt = jwtCallback({ token: {}, account, profile: bad });
    expect(jwt.accessToken).toBeUndefined();
    expect(jwt.login).toBeUndefined();
  });
});

describe("sessionCallback", () => {
  it("returns login, avatar and expiry without the token", () => {
    const token = jwtCallback({ token: { sub: "1" }, account, profile });
    const session = sessionCallback({ session: { expires: "2030-01-01T00:00:00.000Z" }, token });
    expect(session.user?.login).toBe("octocat");
    expect(session.user?.image).toBe("https://avatars.githubusercontent.com/u/1");
    expect(session.expires).toBe("2030-01-01T00:00:00.000Z");
    expect(JSON.stringify(session)).not.toContain(TOKEN);
    expect(JSON.stringify(session)).not.toMatch(/accessToken/i);
  });

  it("returns no user when the token has no login", () => {
    const session = sessionCallback({ session: { expires: "x" }, token: {} });
    expect(session).toEqual({ expires: "x" });
  });
});
