import type { RunOperation } from "../git/workspace.types";

export type StashPanelProps = {
  repo: string;
  revision: number;
  isBusy: boolean;
  hasChanges: boolean;
  run: RunOperation;
};
