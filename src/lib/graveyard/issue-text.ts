/** The text "Copy issue" puts on the clipboard: the title, a blank line, then the body. */
export function buildIssueText(title: string, body: string): string {
  return `${title}\n\n${body}`;
}
