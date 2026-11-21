/**
 * Returns the URL only when it is a plain https://github.com link with no
 * port, username or password. Returns null otherwise. Never throws.
 */
export function safeIssueLink(url: unknown): string | null {
  if (typeof url !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "github.com" ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    return null;
  }
  return url;
}
