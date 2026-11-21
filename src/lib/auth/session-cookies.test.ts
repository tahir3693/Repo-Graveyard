import { describe, expect, it } from "vitest";
import { appendClearCookies, sessionCookieNames } from "./session-cookies";

describe("sessionCookieNames", () => {
  it("keeps plain, secure and chunked session cookies", () => {
    const names = [
      "next-auth.session-token",
      "next-auth.session-token.0",
      "next-auth.session-token.1",
      "__Secure-next-auth.session-token",
      "__Secure-next-auth.session-token.12",
    ];
    expect(sessionCookieNames(names)).toEqual(names);
  });

  it("ignores unrelated and look-alike cookies", () => {
    expect(
      sessionCookieNames([
        "theme",
        "next-auth.csrf-token",
        "__Host-next-auth.csrf-token",
        "next-auth.callback-url",
        "next-auth.session-token.",
        "next-auth.session-token.x",
        "next-auth.session-token.1a",
        "next-auth.session-tokens",
        "x-next-auth.session-token",
      ]),
    ).toEqual([]);
  });

  it("returns an empty list for no cookies", () => {
    expect(sessionCookieNames([])).toEqual([]);
  });
});

describe("appendClearCookies", () => {
  it("appends one expiring Set-Cookie per name", () => {
    const headers = new Headers();
    appendClearCookies(headers, ["next-auth.session-token", "next-auth.session-token.0"]);
    expect(headers.getSetCookie()).toEqual([
      "next-auth.session-token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
      "next-auth.session-token.0=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
    ]);
  });

  it("adds Secure only for __Secure- names", () => {
    const headers = new Headers();
    appendClearCookies(headers, ["__Secure-next-auth.session-token.1"]);
    expect(headers.getSetCookie()).toEqual([
      "__Secure-next-auth.session-token.1=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure",
    ]);
  });

  it("adds nothing for an empty list", () => {
    const headers = new Headers();
    appendClearCookies(headers, []);
    expect(headers.getSetCookie()).toEqual([]);
  });
});
