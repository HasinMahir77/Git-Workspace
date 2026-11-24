import type { MenuBarMenu } from "../components/menu-bar.types";
import type { MenuItem } from "../components/context-menu.types";
import type { AppMenuActions } from "./app-menu.types";

const SEPARATOR: MenuItem = { type: "separator" };

export function appMenus(actions: AppMenuActions): MenuBarMenu[] {
  const { hasRepository, isBusy } = actions;
  return [
    {
      label: "File",
      items: [
        { label: "New repository…", action: actions.newRepository, isEnabled: !isBusy },
        { label: "Add local repository…", shortcut: "Ctrl+O", action: actions.addRepository, isEnabled: !isBusy },
        { label: "Clone repository…", action: actions.cloneRepository, isEnabled: !isBusy },
        SEPARATOR,
        { label: "Options…", shortcut: "Ctrl+,", action: actions.openSettings },
        { label: "GitHub accounts…", action: actions.openAccounts },
      ],
    },
    {
      label: "Repository",
      items: [
        { label: "Switch repository…", shortcut: "Ctrl+K", action: actions.switchRepository },
        SEPARATOR,
        { label: "Refresh", action: actions.refresh, isEnabled: hasRepository && !isBusy },
        { label: "Open in Terminal", action: actions.openTerminal, isEnabled: hasRepository },
        { label: "Show in your File Manager", action: actions.showInFiles, isEnabled: hasRepository },
        { label: actions.editorLabel ? `Open in ${actions.editorLabel}` : "Open in external editor", action: actions.openInEditor, isEnabled: hasRepository && actions.editorLabel !== null },
        { label: "View on GitHub", action: actions.viewOnGitHub, isEnabled: hasRepository && actions.hasGitHubRemote },
      ],
    },
    {
      label: "Branch",
      items: [
        { label: "Branches…", action: actions.openBranches, isEnabled: hasRepository && !isBusy },
        { label: "Compare branches…", action: actions.compareBranches, isEnabled: hasRepository && !isBusy },
        SEPARATOR,
        { label: actions.syncTitle ?? "Fetch", action: actions.sync, isEnabled: hasRepository && !isBusy && actions.syncTitle !== null },
      ],
    },
  ];
}
