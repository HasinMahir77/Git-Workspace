import type { Status } from "../git/bindings";
import type { SyncAction } from "../git/sync.types";

export type SyncButtonProps = {
  action: SyncAction;
  status: Status;
  fetchRemote: string | null;
  lastFetch?: number;
  isBusy: boolean;
  activate: () => void;
  fetch: () => void;
};
