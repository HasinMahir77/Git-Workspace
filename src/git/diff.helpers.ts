import type { DiffLine, DiffRow } from "./diff.types";

export function splitDiff(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  const deletions: DiffLine[] = [];
  const additions: DiffLine[] = [];
  let left = 0;
  let right = 0;
  let isInHunk = false;

  function flush() {
    for (let index = 0; index < Math.max(deletions.length, additions.length); index += 1) {
      rows.push({ left: deletions[index] ?? null, right: additions[index] ?? null });
    }
    deletions.length = 0;
    additions.length = 0;
  }

  for (const line of patch.replace(/\n$/, "").split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    const prefix = line[0];
    if (hunk) {
      flush();
      left = Number(hunk[1]);
      right = Number(hunk[2]);
      isInHunk = true;
      rows.push({ meta: line });
    } else if (isInHunk && prefix === "-") {
      deletions.push({ number: left++, text: line.slice(1), kind: "deletion" });
    } else if (isInHunk && prefix === "+") {
      additions.push({ number: right++, text: line.slice(1), kind: "addition" });
    } else if (isInHunk && prefix === " ") {
      flush();
      const text = line.slice(1);
      rows.push({ left: { number: left++, text, kind: "context" }, right: { number: right++, text, kind: "context" } });
    } else {
      flush();
      if (line.startsWith("diff ")) {
        isInHunk = false;
      }
      rows.push({ meta: line });
    }
  }
  flush();
  return rows;
}
