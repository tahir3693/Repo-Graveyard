import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sessionCallback } from "@/lib/auth/callbacks";

const nextAuthMock = vi.hoisted(() => vi.fn());
vi.mock("next-auth", () => ({ default: nextAuthMock }));

import { GET, POST } from "./route";

const ENV_KEYS = ["GITHUB_ID", "GITHUB_SECRET", "AUTH_SECRET"] as const;
const context = { params: Promise.resolve({ nextauth: ["session"] }) };
const request = new Request("http://localhost/api/auth/session") as NextRequest;

describe("auth route handler", () => {
  beforeEach(() => {
    nextAuthMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("when auth is not configured", () => {
    beforeEach(() => {
      for (const key of ENV_KEYS) vi.stubEnv(key, "");
    });

    it.each([
      ["GET", GET],
      ["POST", POST],
    ])("%s returns the 503 safe error without naming variables", async (_name, handler) => {
      const response = await handler(request, context);
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(JSON.parse(text)).toEqual({
        error: { code: "auth_not_configured", message: "Sign-in is not available right now." },
      });
      expect(text).not.toContain("GITHUB");
      expect(text).not.toContain("AUTH_SECRET");
      expect(nextAuthMock).not.toHaveBeenCalled();
    });
  });

  describe("when auth is configured", () => {
    beforeEach(() => {
      vi.stubEnv("GITHUB_ID", "client-id-1");
      vi.stubEnv("GITHUB_SECRET", "client-secret-1");
      vi.stubEnv("AUTH_SECRET", "auth-secret-1");
    });

    it.each([
      ["GET", GET],
      ["POST", POST],
    ])("%s delegates to NextAuth with public_repo options", async (_name, handler) => {
      const delegated = new Response("ok");
      nextAuthMock.mockResolvedValue(delegated);

      const response = await handler(request, context);

      expect(response).toBe(delegated);
      expect(nextAuthMock).toHaveBeenCalledTimes(1);
      const [req, ctx, options] = nextAuthMock.mock.calls[0];
      expect(req).toBe(request);
      expect(ctx).toBe(context);
      expect(options.providers[0].options.authorization).toEqual({
        params: { scope: "public_repo" },
      });
      expect(options.secret).toBe("auth-secret-1");
      expect(options.callbacks.session).toBe(sessionCallback);
    });
  });
});
