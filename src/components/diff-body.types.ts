import type { DiffView } from "../git/diff-view.types";
import type { DiffRow, UnifiedRow } from "../git/diff.types";
import type { HunkAction, StagingVerb } from "./diff-panel.types";

export type DiffBodyProps = {
  diffView: DiffView;
  unifiedRows: UnifiedRow[];
  splitRows: DiffRow[];
  hunkAction?: HunkAction;
  isIncluded: boolean;
};

export type LineRange = { hunk: number; from: number; to: number };

export type HunkControls = {
  verb: StagingVerb;
  isDisabled: boolean;
  isIncluded: boolean;
  isHot: (hunk: number, line?: number) => boolean;
  hover: (range: LineRange | null) => void;
  startDrag: (hunk: number, line: number) => void;
  extendDrag: (hunk: number, line: number) => boolean;
  toggleHunk: (hunk: number) => void;
  toggleLines: (hunk: number, lines: number[]) => void;
};
