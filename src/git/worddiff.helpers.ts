import type { DiffRow, UnifiedRow } from "./diff.types";
import type { TextSegment, WordPair } from "./worddiff.types";

const TOKEN = /\w+|\s+|[^\w\s]/gu;
const MAX_TOKENS = 300;

const tokensOf = (text: string) => text.match(TOKEN) ?? [];

function merge(parts: TextSegment[]): TextSegment[] {
  const merged: TextSegment[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last && last.isChanged === part.isChanged) last.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}

/** Marks the words that differ between two versions of a line, or returns null when little is shared. */
export function wordSegments(before: string, after: string): WordPair | null {
  const a = tokensOf(before);
  const b = tokensOf(after);
  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) return null;
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const left: TextSegment[] = [];
  const right: TextSegment[] = [];
  let hasSharedWord = false;
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      if (a[i]!.trim()) hasSharedWord = true;
      left.push({ text: a[i]!, isChanged: false });
      right.push({ text: b[j]!, isChanged: false });
      i += 1;
      j += 1;
    } else if (j >= b.length || (i < a.length && table[i + 1]![j]! >= table[i]![j + 1]!)) {
      left.push({ text: a[i]!, isChanged: true });
      i += 1;
    } else {
      right.push({ text: b[j]!, isChanged: true });
      j += 1;
    }
  }
  return hasSharedWord ? { before: merge(left), after: merge(right) } : null;
}

/** Pairs each deleted line with the added line at the same place in its change block. Keys are row indexes. */
export function unifiedWordSegments(rows: UnifiedRow[]): Map<number, TextSegment[]> {
  const result = new Map<number, TextSegment[]>();
  let index = 0;
  while (index < rows.length) {
    const start = index;
    while (rows[index]?.kind === "deletion") index += 1;
    const additionsStart = index;
    while (rows[index]?.kind === "addition") index += 1;
    const pairs = Math.min(additionsStart - start, index - additionsStart);
    for (let offset = 0; offset < pairs; offset += 1) {
      const removed = rows[start + offset]!;
      const added = rows[additionsStart + offset]!;
      const words = wordSegments(removed.text, added.text);
      if (words) {
        result.set(start + offset, words.before);
        result.set(additionsStart + offset, words.after);
      }
    }
    if (index === start) index += 1;
  }
  return result;
}

/** Word changes for rows that hold a deleted and an added line side by side. */
export function splitWordSegments(rows: DiffRow[]): Map<number, WordPair> {
  const result = new Map<number, WordPair>();
  rows.forEach((row, index) => {
    if ("meta" in row || !row.left || !row.right) return;
    if (row.left.kind === "context" || row.right.kind === "context") return;
    const words = wordSegments(row.left.text, row.right.text);
    if (words) result.set(index, words);
  });
  return result;
}
