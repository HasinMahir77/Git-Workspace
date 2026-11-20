import type { RunOperation } from "../git/workspace.types";

export type ComparePanelProps = {
  repo: string;
  current: string | null;
  upstream: string | null;
  revision: number;
  isBusy: boolean;
  isDirty: boolean;
  isPaused: boolean;
  run: RunOperation;
  openChanges: () => void;
  close: () => void;
};
