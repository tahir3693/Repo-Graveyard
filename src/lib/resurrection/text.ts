/**
 * Pure text helpers. No I/O, no clock, no randomness. Client-safe.
 */

const BIDI_OVERRIDES = /[\u202A-\u202E\u2066-\u2069]/g;
const CONTROL_EXCEPT_NEWLINE_TAB = /[^\P{Cc}\n\t]/gu;

/** Replace each lone UTF-16 surrogate with U+FFFD. Uses a unit loop, not a regex flag. */
export function replaceLoneSurrogates(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text[i] + text[i + 1];
        i += 1;
      } else {
        out += "\uFFFD";
      }
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      out += "\uFFFD";
    } else {
      out += text[i];
    }
  }
  return out;
}

/** Remove bidirectional override characters (U+202A to U+202E, U+2066 to U+2069). */
export function removeBidiOverrides(text: string): string {
  return text.replace(BIDI_OVERRIDES, "");
}

export function sanitizeText(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n");
  const noSurrogates = replaceLoneSurrogates(normalized);
  const noControl = noSurrogates.replace(CONTROL_EXCEPT_NEWLINE_TAB, "");
  return removeBidiOverrides(noControl);
}

export function capText(text: unknown, maxChars: number): string {
  if (typeof text !== "string") return "";
  const limit = Number.isInteger(maxChars) && maxChars > 0 ? maxChars : 0;
  const clean = sanitizeText(text);
  if (clean.length <= limit) return clean;
  let count = 0;
  let end = 0;
  for (const point of clean) {
    if (count === limit) break;
    count += 1;
    end += point.length;
  }
  return clean.slice(0, end);
}

export function codePointLength(text: string): number {
  let count = 0;
  for (const _point of text) {
    void _point;
    count += 1;
  }
  return count;
}

export function firstLine(text: string): string {
  const clean = sanitizeText(text);
  const index = clean.indexOf("\n");
  return index === -1 ? clean : clean.slice(0, index);
}
