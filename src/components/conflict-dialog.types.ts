import type { RunOperation } from "../git/workspace.types";

export type ConflictDialogProps = {
  repo: string;
  fileId: string;
  path: string;
  run: RunOperation;
  close: () => void;
};
