import type { Operation, RepositoryInfo, Status, SyncState } from "./bindings";

export type Snapshot = {
  repo: string;
  status: Status | null;
  sync: SyncState | null;
};

export type Draft = { summary: string; body: string };
export type Repositories = { entries: RepositoryInfo[]; selected: string | null };
export type View = "changes" | "history";
export type Theme = "system" | "light" | "dark";
export type DialogKind = "open" | "clone" | "init" | "addRemote" | "fetch" | "push" | "publish";
export type RunOperation = (operation: Operation, label: string) => Promise<boolean>;
