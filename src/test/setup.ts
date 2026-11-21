import http from "node:http";
import https from "node:https";

function describeTarget(input: unknown): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  if (input && typeof input === "object") {
    const o = input as { href?: unknown; protocol?: unknown; hostname?: unknown; host?: unknown; port?: unknown; path?: unknown };
    if (typeof o.href === "string") return o.href;
    const host = typeof o.hostname === "string" ? o.hostname : typeof o.host === "string" ? o.host : "unknown-host";
    const protocol = typeof o.protocol === "string" ? o.protocol : "http:";
    const port = o.port ? `:${String(o.port)}` : "";
    const p = typeof o.path === "string" ? o.path : "";
    return `${protocol}//${host}${port}${p}`;
  }
  return "unknown-url";
}

function blockedError(input: unknown): Error {
  return new Error(`Network request blocked in tests: ${describeTarget(input)}`);
}

function blockedFetch(input: unknown): Promise<Response> {
  return Promise.reject(blockedError(input));
}

function blockedRequest(...args: unknown[]): never {
  throw blockedError(args[0]);
}

globalThis.fetch = blockedFetch as unknown as typeof fetch;

for (const mod of [http, https] as const) {
  const target = mod as unknown as Record<string, unknown>;
  target.request = blockedRequest;
  target.get = blockedRequest;
}
