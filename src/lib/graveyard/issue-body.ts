/**
 * Splits a drafted issue body into plain paragraphs and task lists, so the preview can
 * show the roadmap as readable text. Pure. The result holds text only, never markup:
 * React renders it as text.
 */
export type IssueBodyBlock =
  | { kind: "text"; text: string }
  | { kind: "tasks"; items: Array<{ done: boolean; text: string }> };

const TASK_ITEM = /^[ \t]*[-*] \[([ xX])\][ \t]+(\S.*)$/;

export function parseIssueBody(body: string): IssueBodyBlock[] {
  const blocks: IssueBodyBlock[] = [];
  for (const line of body.split(/\r\n|\r|\n/)) {
    const task = TASK_ITEM.exec(line);
    if (task !== null) {
      const item = { done: task[1] !== " ", text: task[2].trim() };
      const last = blocks[blocks.length - 1];
      if (last !== undefined && last.kind === "tasks") last.items.push(item);
      else blocks.push({ kind: "tasks", items: [item] });
    } else if (line.trim() !== "") {
      blocks.push({ kind: "text", text: line.trim() });
    }
  }
  return blocks;
}
