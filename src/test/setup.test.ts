import http from "node:http";
import https from "node:https";
import { describe, expect, it } from "vitest";

describe("network blocking setup", () => {
  it("rejects a real fetch and names the URL", async () => {
    await expect(fetch("https://api.github.com/user/repos")).rejects.toThrow(
      "https://api.github.com/user/repos",
    );
  });

  it("rejects fetch to api.github.com with the host in the message", async () => {
    await expect(fetch("https://api.github.com/x")).rejects.toThrow("api.github.com");
  });

  it("throws on https.request and names the URL", () => {
    expect(() => https.request("https://api.github.com/rate_limit")).toThrow(
      "https://api.github.com/rate_limit",
    );
  });

  it("throws on http.get and names the host", () => {
    expect(() => http.get({ hostname: "example.test", path: "/x" })).toThrow(
      "example.test",
    );
  });
});
