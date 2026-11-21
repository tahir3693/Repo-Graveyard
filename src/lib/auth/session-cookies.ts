const SESSION_COOKIE_BASES: readonly string[] = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

const SECURE_PREFIX = "__Secure-";

function isSessionCookieName(name: string): boolean {
  return SESSION_COOKIE_BASES.some((base) => {
    if (name === base) return true;
    return name.startsWith(`${base}.`) && /^\d+$/.test(name.slice(base.length + 1));
  });
}

export function sessionCookieNames(requestCookieNames: readonly string[]): string[] {
  return requestCookieNames.filter(isSessionCookieName);
}

export function appendClearCookies(headers: Headers, names: readonly string[]): void {
  for (const name of names) {
    const secure = name.startsWith(SECURE_PREFIX) ? "; Secure" : "";
    headers.append("Set-Cookie", `${name}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`);
  }
}
