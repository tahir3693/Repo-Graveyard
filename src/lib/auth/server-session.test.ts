import { describe, expect, it } from "vitest";
import type { Account, Profile } from "next-auth";
import { jwtCallback, sessionCallback } from "./callbacks";
import { readSessionUser, toSessionUser } from "./server-session";

const TOKEN = "gho_secretTokenValue123";
const account: Account = {
  provider: "github",
  type: "oauth",
  providerAccountId: "1",
  access_token: TOKEN,
  refresh_token: "ghr_refresh",
  id_token: "id-token-value",
};
const profile = {
  login: "octocat",
  avatar_url: "https://avatars.githubusercontent.com/u/1",
  email: null,
  name: null,
} as unknown as Profile;

describe("session sent to the client", () => {
  it("never contains the access token or any other token, even when profile email and name are null", () => {
    const jwt = jwtCallback({ token: { sub: "1" }, account, profile });
    expect(jwt.accessToken).toBe(TOKEN);
    const session = sessionCallback({ session: { expires: "2030-01-01T00:00:00.000Z" }, token: jwt });
    const json = JSON.stringify(session);
    expect(session.user?.login).toBe("octocat");
    expect(json).not.toContain(TOKEN);
    expect(json).not.toContain("ghr_refresh");
    expect(json).not.toContain("id-token-value");
    expect(json).not.toMatch(/token/i);
    expect(Object.keys(session).sort()).toEqual(["expires", "user"]);
    expect(Object.keys(session.user ?? {}).sort()).toEqual(["image", "login"]);
  });

  it("toSessionUser exposes only login and image", () => {
    const jwt = jwtCallback({ token: {}, account, profile });
    const session = sessionCallback({ session: { expires: "x" }, token: jwt });
    const user = toSessionUser({ ...session, accessToken: TOKEN });
    expect(user).toEqual({ login: "octocat", image: "https://avatars.githubusercontent.com/u/1" });
    expect(JSON.stringify(user)).not.toContain(TOKEN);
  });
});

describe("toSessionUser", () => {
  it.each([null, undefined, {}, { user: {} }, { user: { login: "" } }, "octocat"])(
    "returns null for %j",
    (value) => {
      expect(toSessionUser(value)).toBeNull();
    },
  );

  it("defaults a missing image to null", () => {
    expect(toSessionUser({ user: { login: "octocat" } })).toEqual({ login: "octocat", image: null });
  });
});

describe("readSessionUser", () => {
  it("returns null without reading a session when auth is not configured", async () => {
    await expect(readSessionUser({})).resolves.toBeNull();
  });
});
