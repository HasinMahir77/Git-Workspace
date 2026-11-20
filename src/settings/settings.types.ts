import type { GitHubAccounts } from "../git/bindings";
import type { Theme } from "../git/workspace.types";

export type SettingsSection = "appearance" | "accounts" | "environment";

export type SettingsProps = {
  section: SettingsSection;
  selectSection: (section: SettingsSection) => void;
  close: () => void;
  theme: Theme;
  changeTheme: (theme: Theme) => void;
  repositoryId?: string;
  accountState: GitHubAccounts | null;
  accountError: string;
  refreshAccounts: () => Promise<void>;
  isWorkspaceBusy: boolean;
};
