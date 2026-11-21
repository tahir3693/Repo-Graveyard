import { describe, expect, it } from "vitest";
import { BANNED_WORDS, containsBannedWord } from "./epitaphs";

describe("containsBannedWord", () => {
  it("matches a whole word, ignoring case", () => {
    expect(containsBannedWord("Quit now")).toBe(true);
    expect(containsBannedWord("It is YOUR repo")).toBe(true);
  });

  it("does not match inside a longer word", () => {
    expect(containsBannedWord("quitting")).toBe(false);
    expect(containsBannedWord("young")).toBe(false);
  });

  it("is false for kind copy", () => {
    expect(containsBannedWord("Paused, not gone. Ready for a free weekend.")).toBe(false);
  });

  it("catches every listed word", () => {
    for (const word of BANNED_WORDS) expect(containsBannedWord(`a ${word}.`)).toBe(true);
  });
});
