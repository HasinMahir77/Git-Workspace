import type { ReactNode } from "react";
import type { RunOperation } from "../git/workspace.types";
import type { Sidebar } from "./sidebar.types";

export type HistoryProps = {
  sidebar: Sidebar;
  repo: string;
  revision: number;
  tabs: ReactNode;
  current: string | null;
  isBusy: boolean;
  isDirty: boolean;
  isPaused: boolean;
  hasGitHubRemote: boolean;
  run: RunOperation;
  report: (message: string) => void;
};
