import type { Status, SyncState } from "../git/bindings";
import type { DialogKind, RunOperation } from "../git/workspace.types";

export type Props = {
  kind: DialogKind;
  status?: Status | null;
  sync?: SyncState | null;
  isBusy: boolean;
  error: string;
  close: () => void;
  open: (path: string) => Promise<boolean>;
  clone: (path: string, name: string, source: string) => Promise<boolean>;
  init: (path: string, name: string) => Promise<boolean>;
  run: RunOperation;
};
