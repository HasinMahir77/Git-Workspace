import type { GitHubAccounts } from "../git/bindings";

export type AccountDialogProps = {
  accountState: GitHubAccounts | null;
  loadError: string;
  refresh: () => Promise<void>;
  close: () => void;
};
