import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

import { getToken } from "next-auth/jwt";
import { readUserToken } from "./token";

const getTokenMock = vi.mocked(getToken);
const req = {} as NextRequest;

describe("readUserToken", () => {
  beforeEach(() => getTokenMock.mockReset());

  it("returns login and accessToken for a valid token", async () => {
    getTokenMock.mockResolvedValue({ login: "octo", accessToken: "tok", avatarUrl: "x" });
    await expect(readUserToken(req, "s")).resolves.toEqual({ login: "octo", accessToken: "tok" });
    expect(getTokenMock).toHaveBeenCalledWith({ req, secret: "s" });
  });

  it("returns null when there is no token", async () => {
    getTokenMock.mockResolvedValue(null);
    await expect(readUserToken(req, "s")).resolves.toBeNull();
  });

  it("returns null when fields are missing or empty", async () => {
    getTokenMock.mockResolvedValue({ login: "octo" });
    await expect(readUserToken(req, "s")).resolves.toBeNull();
    getTokenMock.mockResolvedValue({ login: "", accessToken: "tok" });
    await expect(readUserToken(req, "s")).resolves.toBeNull();
  });

  it("returns null when decoding throws or no secret is available", async () => {
    getTokenMock.mockRejectedValue(new Error("boom"));
    await expect(readUserToken(req, "s")).resolves.toBeNull();
    getTokenMock.mockResolvedValue({ login: "octo", accessToken: "tok" });
    await expect(readUserToken(req, "")).resolves.toBeNull();
  });
});
