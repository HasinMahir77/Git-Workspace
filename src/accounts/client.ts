import { Channel, invoke } from "@tauri-apps/api/core";
import type { GitHubAccounts } from "../git/bindings";

export const github = {
  accounts: () => invoke<GitHubAccounts>("github_accounts"),
  signIn: (onCode: (code: string) => void) => {
    const code = new Channel<string>();
    code.onmessage = onCode;
    return invoke<void>("sign_in_to_github", { code });
  },
  cancel: () => invoke<void>("cancel_github_sign_in"),
  verifyInBrowser: () => invoke<void>("open_github_device_verification"),
  switchAccount: (login: string) => invoke<void>("switch_github_account", { login }),
  setupGitHttps: () => invoke<void>("setup_github_https"),
};
