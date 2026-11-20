import type { Commit } from "../git/bindings";
import type { RunOperation } from "../git/workspace.types";

export type CherryPickOntoProps = {
  commit: Commit;
  destinations: string[];
  focusKey: number;
  isBusy: boolean;
  isDirty: boolean;
  run: RunOperation;
};
