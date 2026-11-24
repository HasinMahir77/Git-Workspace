import type { ChangedFile, RepositoryInfo } from "./bindings";

export type RepositoryMenuActions = {
  entry: RepositoryInfo;
  hasGitHubRemote: boolean;
  editorLabel: string | null;
  copy: (text: string) => void;
  viewOnGitHub: () => void;
  openInTerminal: () => void;
  showInFiles: () => void;
  openInEditor: () => void;
  remove: () => void;
};

export type ChangesMenuActions = {
  repositoryPath: string;
  files: ChangedFile[];
  editorLabel: string | null;
  copy: (text: string) => void;
  discard: (files: ChangedFile[]) => void;
  ignorePath: (path: string) => void;
  ignorePattern: (pattern: string) => void;
  include: (files: ChangedFile[], shouldInclude: boolean) => void;
  showInFiles: (path: string) => void;
  openInEditor: (path: string) => void;
  openDefault: (path: string) => void;
  blame: (path: string) => void;
};

export type ChangesListMenuActions = {
  hasChanges: boolean;
  canStash: boolean;
  discardAll: () => void;
  stashAll: () => void;
};

export type CommitMenuActions = {
  id: string;
  isCurrent: boolean;
  canCherryPick: boolean;
  hasGitHubRemote: boolean;
  copy: (text: string) => void;
  checkout: () => void;
  revert: () => void;
  createBranch: () => void;
  cherryPick: () => void;
  viewOnGitHub: () => void;
};
