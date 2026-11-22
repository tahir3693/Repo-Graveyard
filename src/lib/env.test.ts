import { describe, expect, it } from "vitest";
import { isAuthConfigured, readAuthEnv, readDemoConfig } from "@/lib/env";

const validAuth = { GITHUB_ID: "id", GITHUB_SECRET: "secret", AUTH_SECRET: "auth" };

describe("readAuthEnv", () => {
  it("returns the values when all are set", () => {
    expect(readAuthEnv(validAuth)).toEqual({
      githubId: "id",
      githubSecret: "secret",
      authSecret: "auth",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(readAuthEnv({ ...validAuth, GITHUB_ID: "  id  " })?.githubId).toBe("id");
  });

  it.each(["GITHUB_ID", "GITHUB_SECRET", "AUTH_SECRET"])("returns null when %s is missing", (key) => {
    expect(readAuthEnv({ ...validAuth, [key]: undefined })).toBeNull();
  });

  it.each(["GITHUB_ID", "GITHUB_SECRET", "AUTH_SECRET"])("returns null when %s is empty", (key) => {
    expect(readAuthEnv({ ...validAuth, [key]: "" })).toBeNull();
  });

  it.each(["GITHUB_ID", "GITHUB_SECRET", "AUTH_SECRET"])("returns null when %s is whitespace", (key) => {
    expect(readAuthEnv({ ...validAuth, [key]: "   " })).toBeNull();
  });

  it("returns null for an empty record", () => {
    expect(readAuthEnv({})).toBeNull();
  });
});

describe("readDemoConfig", () => {
  it("returns username and token when valid", () => {
    expect(readDemoConfig({ GITHUB_DEMO_USERNAME: "octocat", GITHUB_DEMO_TOKEN: "tok" })).toEqual({
      username: "octocat",
      token: "tok",
    });
  });

  it("returns a null token when the token is missing, empty or whitespace", () => {
    for (const token of [undefined, "", "  "]) {
      expect(readDemoConfig({ GITHUB_DEMO_USERNAME: "octocat", GITHUB_DEMO_TOKEN: token })?.token).toBeNull();
    }
  });

  it("returns null when the username is missing, empty or whitespace", () => {
    for (const username of [undefined, "", "   "]) {
      expect(readDemoConfig({ GITHUB_DEMO_USERNAME: username })).toBeNull();
    }
  });

  it("returns null for invalid usernames", () => {
    const invalid = ["-octocat", "octo_cat", "octo cat", "octo/cat", "a".repeat(40)];
    for (const username of invalid) {
      expect(readDemoConfig({ GITHUB_DEMO_USERNAME: username })).toBeNull();
    }
  });

  it("accepts the 1 and 39 character boundaries", () => {
    expect(readDemoConfig({ GITHUB_DEMO_USERNAME: "a" })?.username).toBe("a");
    const max = "a".repeat(39);
    expect(readDemoConfig({ GITHUB_DEMO_USERNAME: max })?.username).toBe(max);
  });
});

describe("isAuthConfigured", () => {
  it("is true only when all three auth variables are set", () => {
    expect(isAuthConfigured(validAuth)).toBe(true);
    expect(isAuthConfigured({})).toBe(false);
    expect(isAuthConfigured({ ...validAuth, GITHUB_ID: "  " })).toBe(false);
    expect(isAuthConfigured({ ...validAuth, AUTH_SECRET: undefined })).toBe(false);
  });
});