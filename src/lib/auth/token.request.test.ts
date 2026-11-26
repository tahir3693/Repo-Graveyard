import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readUserTokenFromRequest } from "./token";

// No mocks: real encrypted session cookies go through the real next-auth decoder.
const SECRET = "a-test-signing-secret-of-decent-length";
const ENV = { GITHUB_ID: "id", GITHUB_SECRET: "secret", AUTH_SECRET: SECRET };
const USER = { login: "octo", accessToken: "gho_fake_access_token_for_tests" };

function session(secret = SECRET, token: Record<string, unknown> = USER): Promise<string> {
  return encode({ token, secret });
}

/** A scan-style POST whose body has already been read, as it is when the token is read. */
async function post(cookie: string | null): Promise<Request> {
  const req = new Request("https://repo-graveyard.example/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie === null ? {} : { cookie }) },
    body: JSON.stringify({ demo: false, includeForks: false }),
  });
  await req.text();
  expect(req.bodyUsed).toBe(true);
  return req;
}

afterEach(() => vi.unstubAllEnvs());

describe("readUserTokenFromRequest", () => {
  it("reads the user from a request whose body was already read", async () => {
    const jwt = await session();
    await expect(readUserTokenFromRequest(await post(`next-auth.session-token=${jwt}`), ENV)).resolves.toEqual(USER);
  });

  it("reads the user when the route handler is given a NextRequest", async () => {
    const jwt = await session();
    const req = new NextRequest("https://repo-graveyard.example/api/scan", {
      method: "POST",
      headers: { cookie: `__Secure-next-auth.session-token=${jwt}` },
      body: "{}",
    });
    await req.text();
    await expect(readUserTokenFromRequest(req, ENV)).resolves.toEqual(USER);
  });

  it("finds a __Secure- session cookie even when NEXTAUTH_URL says http", async () => {
    vi.stubEnv("NEXTAUTH_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL", "");
    const jwt = await session();
    await expect(
      readUserTokenFromRequest(await post(`__Secure-next-auth.session-token=${jwt}`), ENV),
    ).resolves.toEqual(USER);
  });

  it("finds a plain session cookie even when NEXTAUTH_URL says https", async () => {
    vi.stubEnv("NEXTAUTH_URL", "https://repo-graveyard.example");
    const jwt = await session();
    await expect(readUserTokenFromRequest(await post(`next-auth.session-token=${jwt}`), ENV)).resolves.toEqual(USER);
  });

  it("returns null, not an exception, for a cookie signed with another secret", async () => {
    const jwt = await session("some-other-secret-of-decent-length-x");
    await expect(readUserTokenFromRequest(await post(`next-auth.session-token=${jwt}`), ENV)).resolves.toBeNull();
  });

  it("returns null for no cookie, for unrelated cookies, and for garbage", async () => {
    await expect(readUserTokenFromRequest(await post(null), ENV)).resolves.toBeNull();
    await expect(readUserTokenFromRequest(await post("theme=dark; a=b"), ENV)).resolves.toBeNull();
    await expect(readUserTokenFromRequest(await post("next-auth.session-token=not-a-jwt"), ENV)).resolves.toBeNull();
  });

  it("returns null when the auth env is missing", async () => {
    const jwt = await session();
    await expect(
      readUserTokenFromRequest(await post(`next-auth.session-token=${jwt}`), { GITHUB_ID: "id" }),
    ).resolves.toBeNull();
  });

  it("returns null for a session with no access token", async () => {
    const jwt = await session(SECRET, { login: "octo" });
    await expect(readUserTokenFromRequest(await post(`next-auth.session-token=${jwt}`), ENV)).resolves.toBeNull();
  });
});
