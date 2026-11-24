import type { ReactNode } from "react";
import type { FileKind } from "./changes.constants";

export type StagingVerb = "Stage" | "Unstage";

export type HunkAction = {
  verb: StagingVerb;
  isDisabled: boolean;
  toggleHunk: (index: number, header: string) => void;
  toggleLines: (index: number, header: string, lines: number[]) => void;
};

export type Props = {
  title?: string;
  detail?: string;
  emptyTitle?: string;
  actions?: ReactNode;
  patch: string | null;
  error?: string;
  isHistory?: boolean;
  isStaged?: boolean;
  fileStatus?: { kind: FileKind; label: string };
  hunkAction?: HunkAction;
};
