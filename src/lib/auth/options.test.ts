import { describe, expect, it } from "vitest";
import { jwtCallback, sessionCallback } from "./callbacks";
import { createAuthOptions } from "./options";

const env = { githubId: "client-id-1", githubSecret: "client-secret-1", authSecret: "auth-secret-1" };

describe("createAuthOptions", () => {
  const options = createAuthOptions(env);

  it("uses the GitHub provider with the env client id and public_repo scope", () => {
    expect(options.providers).toHaveLength(1);
    const provider = options.providers[0];
    expect(provider.id).toBe("github");
    expect(provider.options?.clientId).toBe("client-id-1");
    expect(provider.options?.clientSecret).toBe("client-secret-1");
    expect(provider.options?.authorization).toEqual({ params: { scope: "public_repo" } });
  });

  it("uses jwt sessions, the auth secret and landing-page pages", () => {
    expect(options.session?.strategy).toBe("jwt");
    expect(options.secret).toBe("auth-secret-1");
    expect(options.pages).toEqual({ signIn: "/", error: "/" });
  });

  it("wires the callbacks from callbacks.ts", () => {
    expect(options.callbacks?.jwt).toBe(jwtCallback);
    expect(options.callbacks?.session).toBe(sessionCallback);
  });

  it("does not enable debug and silences the logger", () => {
    expect(options.debug).toBeUndefined();
    expect(() => {
      options.logger?.error?.("CODE", new Error("secret-token"));
      options.logger?.debug?.("CODE", { token: "secret-token" });
      options.logger?.warn?.("DEBUG_ENABLED");
    }).not.toThrow();
  });
});
