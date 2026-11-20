import type { Commit } from "../git/bindings";
import type { RunOperation } from "../git/workspace.types";

export type CherryPickOntoProps = {
  repo: string;
  commit: Commit;
  current: string | null;
  isBusy: boolean;
  isDirty: boolean;
  run: RunOperation;
};
