import type { GitHubAccounts } from "../git/bindings";

export type AccountSettingsProps = {
  accountState: GitHubAccounts | null;
  loadError: string;
  refresh: () => Promise<void>;
  isWorkspaceBusy: boolean;
};
