import type { RunOperation } from "../git/workspace.types";

export type BranchMenuProps = {
  repo: string;
  current: string | null;
  isBusy: boolean;
  close: (shouldFocus?: boolean) => void;
  run: RunOperation;
  compare: () => void;
};
