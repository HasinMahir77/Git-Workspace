import type { DiffLine, DiffRow, UnifiedRow } from "./diff.types";

export function splitDiff(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  const deletions: DiffLine[] = [];
  const additions: DiffLine[] = [];
  let left = 0;
  let right = 0;
  let hunkLine = 0;
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
      hunkLine = 0;
      isInHunk = true;
      rows.push({ meta: line });
    } else if (isInHunk && prefix === "-") {
      deletions.push({ number: left++, text: line.slice(1), kind: "deletion", hunkLine: hunkLine++ });
    } else if (isInHunk && prefix === "+") {
      additions.push({ number: right++, text: line.slice(1), kind: "addition", hunkLine: hunkLine++ });
    } else if (isInHunk && prefix === " ") {
      flush();
      const text = line.slice(1);
      rows.push({ left: { number: left++, text, kind: "context", hunkLine }, right: { number: right++, text, kind: "context", hunkLine: hunkLine++ } });
    } else {
      flush();
      if (isInHunk && prefix === "\\") hunkLine += 1;
      if (line.startsWith("diff ")) {
        isInHunk = false;
      }
      rows.push({ meta: line });
    }
  }
  flush();
  return rows;
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const HIDDEN_META = /^(?:index |--- |\+\+\+ )/;

export function unifiedDiff(patch: string, isHistory: boolean): UnifiedRow[] {
  const rows: UnifiedRow[] = [];
  let oldNumber = 0;
  let newNumber = 0;
  let hunkIndex = 0;
  let hunkLine = 0;
  let isInHunk = false;

  for (const line of patch.replace(/\n$/, "").split("\n")) {
    const hunk = HUNK_HEADER.exec(line);
    const prefix = line[0];
    if (hunk) {
      oldNumber = Number(hunk[1]);
      newNumber = Number(hunk[2]);
      hunkLine = 0;
      isInHunk = true;
      rows.push({ kind: "hunk", text: line, hunkIndex });
      hunkIndex += 1;
    } else if (isInHunk && prefix === "\\") {
      rows.push({ kind: "note", text: line });
      hunkLine += 1;
    } else if (isInHunk && prefix === "-") {
      rows.push({ kind: "deletion", text: line.slice(1), oldNumber: oldNumber++, newNumber: null, hunkLine: hunkLine++ });
    } else if (isInHunk && prefix === "+") {
      rows.push({ kind: "addition", text: line.slice(1), oldNumber: null, newNumber: newNumber++, hunkLine: hunkLine++ });
    } else if (isInHunk && prefix === " ") {
      rows.push({ kind: "context", text: line.slice(1), oldNumber: oldNumber++, newNumber: newNumber++, hunkLine: hunkLine++ });
    } else if (line.startsWith("diff ")) {
      isInHunk = false;
      if (isHistory) rows.push({ kind: "file", text: line });
    } else if (!HIDDEN_META.test(line)) {
      rows.push({ kind: "meta", text: line });
    }
  }
  return rows;
}

const MIN_LINE_NUMBER_DIGITS = 3;
const LINE_NUMBER_DIGIT_WIDTH = 10;
const LINE_NUMBER_PADDING = 5;

export function lineNumberWidth(largestLineNumber: number): number {
  return Math.max(String(largestLineNumber).length, MIN_LINE_NUMBER_DIGITS) * LINE_NUMBER_DIGIT_WIDTH + LINE_NUMBER_PADDING;
}

export function changedLinesBetween(rows: UnifiedRow[], hunkIndex: number, from: number, to: number): number[] {
  const [low, high] = from <= to ? [from, to] : [to, from];
  let hunk = -1;
  return rows.flatMap((row) => {
    if (row.kind === "hunk") hunk = row.hunkIndex;
    const isChange = row.kind === "addition" || row.kind === "deletion";
    return isChange && hunk === hunkIndex && row.hunkLine >= low && row.hunkLine <= high ? [row.hunkLine] : [];
  });
}
