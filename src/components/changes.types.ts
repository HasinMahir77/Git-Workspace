import type { MouseEvent, ReactNode } from "react";
import type { ChangedFile, Status } from "../git/bindings";
import type { Draft, RunOperation } from "../git/workspace.types";

export type Selection = { id: string; isStaged: boolean };
export type Props = {
  repo: string;
  tabs: ReactNode;
  viewHistory: () => void;
  openTerminal: () => void;
  status: Status;
  revision: number;
  isBusy: boolean;
  draft: Draft;
  changeDraft: (draft: Draft) => void;
  run: RunOperation;
};

export type FileGroupProps = {
  files: ChangedFile[];
  isStaged: boolean;
  selectedIds: string[];
  select: (selection: Selection, event: MouseEvent<HTMLButtonElement>) => void;
  selectAll: () => void;
  isBusy: boolean;
  run: RunOperation;
};
