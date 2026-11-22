import { describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "@/lib/graveyard/clipboard";

describe("copyToClipboard", () => {
  it("writes the text and reports success", async () => {
    const writeText = vi.fn(async () => undefined);
    await expect(copyToClipboard("hello", { writeText })).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledExactlyOnceWith("hello");
  });

  it("reports failure, without throwing, when the browser refuses", async () => {
    const writeText = vi.fn(async () => {
      throw new Error("NotAllowedError secret detail");
    });
    await expect(copyToClipboard("hello", { writeText })).resolves.toBe(false);
  });

  it("reports failure when there is no clipboard", async () => {
    await expect(copyToClipboard("hello", undefined)).resolves.toBe(false);
  });

  it("reports failure when writeText is missing", async () => {
    const broken = {} as unknown as { writeText: (text: string) => Promise<void> };
    await expect(copyToClipboard("hello", broken)).resolves.toBe(false);
  });
});
