import type { DiffRow, UnifiedRow } from "./diff.types";
import { MAX_HIGHLIGHT_LINE_LENGTH } from "./syntax.constants";
import { layerSpans, tokenize } from "./syntax.helpers";
import type { Language, Span } from "./syntax.types";
import { splitWordSegments, unifiedWordSegments } from "./worddiff.helpers";
import type { TextSegment } from "./worddiff.types";

export type SplitSpans = { before?: Span[]; after?: Span[] };

function spansOf(text: string, language: Language | null, words?: TextSegment[]): Span[] {
  return layerSpans(tokenize(text, text.length > MAX_HIGHLIGHT_LINE_LENGTH ? null : language), words);
}

/** Coloured pieces for each unified row, or undefined where a row needs no extra markup. */
export function unifiedSpans(rows: UnifiedRow[], language: Language | null): (Span[] | undefined)[] {
  const words = unifiedWordSegments(rows);
  return rows.map((row, index) => {
    if (!("oldNumber" in row) || (!language && !words.has(index))) return undefined;
    return spansOf(row.text, language, words.get(index));
  });
}

export function splitSpans(rows: DiffRow[], language: Language | null): (SplitSpans | undefined)[] {
  const words = splitWordSegments(rows);
  return rows.map((row, index) => {
    if ("meta" in row) return undefined;
    const pair = words.get(index);
    if (!language && !pair) return undefined;
    return {
      before: row.left ? spansOf(row.left.text, language, pair?.before) : undefined,
      after: row.right ? spansOf(row.right.text, language, pair?.after) : undefined,
    };
  });
}
