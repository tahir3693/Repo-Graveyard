/** The one clipboard method we use. Injected in tests. */
export type ClipboardWriter = { writeText: (text: string) => Promise<void> };

/**
 * Browser only. Copies text and reports whether it worked. Never throws and never
 * echoes the text or the browser's error, so a failure shows only a fixed message.
 */
export async function copyToClipboard(
  text: string,
  clipboard: ClipboardWriter | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator.clipboard,
): Promise<boolean> {
  if (clipboard === undefined || typeof clipboard.writeText !== "function") return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
