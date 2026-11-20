import type { MouseEvent, ReactNode } from "react";
import type { ChangedFile, Status } from "../git/bindings";
import type { Draft, RunOperation } from "../git/workspace.types";
import type { Sidebar } from "./sidebar.types";

export type DiffSide = { id: string; isStaged: boolean };
export type Props = {
  sidebar: Sidebar;
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

export type FileRowProps = {
  file: ChangedFile;
  isSelected: boolean;
  select: (id: string, event: MouseEvent<HTMLButtonElement>) => void;
  toggle: (file: ChangedFile) => void;
  isBusy: boolean;
};
