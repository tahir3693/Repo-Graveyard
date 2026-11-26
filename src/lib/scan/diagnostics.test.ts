import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  cutMessage,
  describeError,
  describeZodIssue,
  MESSAGE_MAX_CHARS,
  redact,
  safeErrorName,
  safeMessage,
  toLogLine,
} from "./diagnostics";

const FAKE_TOKEN = "ghp_FAKEfakeFAKE0123456789abcdefABCDEF01";

describe("redact", () => {
  it("replaces GitHub token shapes", () => {
    for (const token of ["ghp_abc123", "gho_abc123", "ghu_abc123", "ghs_abc123", "ghr_abc123", FAKE_TOKEN]) {
      expect(redact(`failed with ${token} here`)).toBe("failed with [redacted] here");
    }
    expect(redact("x github_pat_11ABCDEFG0abcdefghijklmnop_qrstuvwx y")).toBe("x [redacted] y");
  });

  it("replaces a Bearer header value, case-insensitively", () => {
    expect(redact("Authorization: Bearer abc.def-ghi")).toBe("Authorization: [redacted]");
    expect(redact("sent bearer   eyJhbGciOi")).toBe("sent [redacted]");
  });

  it("replaces long base64 strings, such as a session cookie or a signing key", () => {
    const cookie = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..AbCdEfGhIjKlMnOp.QrStUvWxYz0123456789";
    expect(redact(`cookie ${cookie} end`)).not.toContain("eyJhbGci");
    const key = "dGhpcyBpcyBhIDMyIGJ5dGUgc2lnbmluZyBrZXkh+/==";
    expect(redact(`secret=${key}`)).toBe("secret=[redacted]");
  });

  it("keeps ordinary short text", () => {
    expect(redact("Cannot read properties of undefined (reading 'name')")).toBe(
      "Cannot read properties of undefined (reading 'name')",
    );
  });

  it("never leaves a cut-off token behind on a huge input", () => {
    const secret = "A".repeat(40);
    const input = `${"x ".repeat(4_999)}ghp_${secret}${secret}`;
    expect(redact(input)).not.toContain(secret.slice(0, 10));
  });

  it("property: a token with a known prefix never survives, wherever it sits", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("ghp_", "gho_", "ghu_", "ghs_", "ghr_", "github_pat_"),
        fc.stringMatching(/^[A-Za-z0-9_]{6,60}$/),
        fc.string({ maxLength: 40 }),
        fc.string({ maxLength: 40 }),
        (prefix, body, before, after) => {
          const token = `${prefix}${body}`;
          expect(redact(`${before} ${token} ${after}`)).not.toContain(token);
        },
      ),
    );
  });
});

describe("cutMessage", () => {
  it("cuts to 120 characters after redacting, on one line", () => {
    const text = `line one\nline two ${"word ".repeat(60)}`;
    const cut = cutMessage(text);
    expect(Array.from(cut).length).toBeLessThanOrEqual(MESSAGE_MAX_CHARS);
    expect(cut).not.toContain("\n");
  });

  it("redacts before cutting, so a token on the boundary is never half shown", () => {
    const text = `${"a ".repeat(55)}${FAKE_TOKEN} tail`;
    const cut = cutMessage(text);
    expect(cut).not.toContain("ghp_");
    expect(cut).not.toContain("FAKEfake");
  });

  it("property: the result is at most 120 characters and never contains a ghp_ token", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), fc.stringMatching(/^[A-Za-z0-9_]{8,40}$/), (text, body) => {
        const token = `ghp_${body}`;
        const cut = cutMessage(`${text} ${token}`);
        expect(Array.from(cut).length).toBeLessThanOrEqual(MESSAGE_MAX_CHARS);
        expect(cut).not.toContain(token);
      }),
    );
  });
});

describe("safeErrorName and safeMessage", () => {
  it("keeps a plain error name and drops anything odd", () => {
    expect(safeErrorName(new TypeError("x"))).toBe("TypeError");
    expect(safeErrorName({ name: "bad name\nwith newline" })).toBe("NonError");
    expect(safeErrorName("a string")).toBe("NonError");
    expect(safeErrorName(null)).toBe("NonError");
    const odd = new Error("x");
    odd.name = "not a valid name!";
    expect(safeErrorName(odd)).toBe("Error");
  });

  it("redacts a token that was put into the name", () => {
    expect(safeErrorName({ name: FAKE_TOKEN })).not.toContain("ghp_");
  });

  it("reads the message of an Error or a thrown string, and nothing else", () => {
    expect(safeMessage(new Error("boom"))).toBe("boom");
    expect(safeMessage("thrown text")).toBe("thrown text");
    expect(safeMessage({ message: 42 })).toBe("");
    expect(safeMessage(undefined)).toBe("");
  });
});

describe("describeError", () => {
  it("returns only a name, a step and a redacted message, never the error", () => {
    const error = new Error(`token ${FAKE_TOKEN} was rejected`);
    const result = describeError(error, "read-token");
    expect(Object.keys(result).sort()).toEqual(["errorName", "message", "step"]);
    expect(result.step).toBe("read-token");
    expect(JSON.stringify(result)).not.toContain(FAKE_TOKEN);
    expect(JSON.stringify(result)).not.toContain("stack");
    expect(result.message).toContain("[redacted]");
  });
});

describe("describeZodIssue", () => {
  it("gives the failing field path and issue code, and no value", () => {
    const schema = z.object({ repos: z.array(z.object({ url: z.url() })) });
    const parsed = schema.safeParse({ repos: [{ url: "https://ok.example" }, { url: "SECRET-VALUE" }] });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const text = describeZodIssue(parsed.error);
      expect(text).toMatch(/^repos\.1\.url: /);
      expect(text).not.toContain("SECRET-VALUE");
    }
  });
});

describe("toLogLine", () => {
  it("keeps only the five allowed fields and drops anything else", () => {
    const dirty = {
      code: "internal_error",
      requestId: "r1",
      errorName: "TypeError",
      step: "read-token",
      message: `Bearer ${FAKE_TOKEN}`,
      stack: "at secret (file.ts:1:1)",
      headers: { cookie: "x" },
    };
    const line = toLogLine(dirty);
    expect(Object.keys(line).sort()).toEqual(["code", "errorName", "message", "requestId", "step"]);
    expect(JSON.stringify(line)).not.toContain("ghp_");
    expect(JSON.stringify(line)).not.toContain("stack");
  });

  it("leaves an entry with only code and requestId alone", () => {
    expect(toLogLine({ code: "unauthorized", requestId: "r1" })).toEqual({ code: "unauthorized", requestId: "r1" });
  });
});
