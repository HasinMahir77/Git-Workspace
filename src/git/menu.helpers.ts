import type { MenuItem } from "../components/context-menu.types";
import type { ChangesListMenuActions, ChangesMenuActions, CommitMenuActions, RepositoryMenuActions } from "./menu.types";

const SEPARATOR: MenuItem = { type: "separator" };
const IGNORE_FILE = ".gitignore";
const MAX_EXTENSION_ITEMS = 5;
const OPEN_IN_EDITOR = "Open in external editor";

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

function extensionOf(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot) : "";
}

export function repositoryMenu(actions: RepositoryMenuActions): MenuItem[] {
  const { entry } = actions;
  return [
    { label: "Copy repo name", action: () => actions.copy(entry.name) },
    { label: "Copy repo path", action: () => actions.copy(entry.path) },
    SEPARATOR,
    { label: "View on GitHub", action: actions.viewOnGitHub, isEnabled: actions.hasGitHubRemote },
    { label: "Open in Terminal", action: actions.openInTerminal },
    { label: "Show in your File Manager", action: actions.showInFiles },
    { label: actions.editorLabel ? `Open in ${actions.editorLabel}` : OPEN_IN_EDITOR, action: actions.openInEditor, isEnabled: actions.editorLabel !== null },
    SEPARATOR,
    { label: "Remove…", action: actions.remove },
  ];
}

export function changesMenu(actions: ChangesMenuActions): MenuItem[] {
  const { files } = actions;
  const [file] = files;
  if (!file) return [];
  const paths = files.map((entry) => entry.path);
  const isSingle = files.length === 1;
  const isDeleted = isSingle && (file.unstaged === "D" || file.staged === "D");
  const extensions = [...new Set(paths.map(extensionOf).filter(Boolean))].slice(0, MAX_EXTENSION_ITEMS);
  const folders = file.path.split("/").slice(0, -1);
  const canIgnore = paths.some((path) => baseName(path) !== IGNORE_FILE);
  const items: MenuItem[] = [
    { label: isSingle ? "Discard changes…" : `Discard ${files.length} selected changes…`, action: () => actions.discard(files) },
    SEPARATOR,
  ];
  if (isSingle) {
    items.push({ label: "Ignore file (add to .gitignore)", action: () => actions.ignorePath(file.path), isEnabled: canIgnore });
    if (folders.length > 0) {
      items.push({
        label: "Ignore folder (add to .gitignore)",
        isEnabled: canIgnore,
        submenu: folders.map((_, index) => {
          const folder = `/${folders.slice(0, folders.length - index).join("/")}`;
          return { label: folder, action: () => actions.ignorePath(folder) };
        }),
      });
    }
  } else {
    items.push({
      label: `Ignore ${files.length} selected files (add to .gitignore)`,
      isEnabled: canIgnore,
      action: () => paths.filter((path) => baseName(path) !== IGNORE_FILE).forEach(actions.ignorePath),
    });
  }
  for (const extension of extensions) {
    items.push({ label: `Ignore all ${extension} files (add to .gitignore)`, action: () => actions.ignorePattern(`*${extension}`) });
  }
  items.push(SEPARATOR);
  if (isSingle) {
    items.push(
      { label: "Copy file path", action: () => actions.copy(`${actions.repositoryPath}/${file.path}`) },
      { label: "Copy relative file path", action: () => actions.copy(file.path) },
    );
  } else {
    items.push(
      { label: "Include selected files", action: () => actions.include(files, true) },
      { label: "Exclude selected files", action: () => actions.include(files, false) },
      SEPARATOR,
      { label: "Copy paths", action: () => actions.copy(paths.map((path) => `${actions.repositoryPath}/${path}`).join("\n")) },
      { label: "Copy relative paths", action: () => actions.copy(paths.join("\n")) },
    );
  }
  items.push(
    SEPARATOR,
    { label: "Show in your File Manager", action: () => actions.showInFiles(file.path), isEnabled: !isDeleted },
    { label: actions.editorLabel ? `Open in ${actions.editorLabel}` : OPEN_IN_EDITOR, action: () => actions.openInEditor(file.path), isEnabled: !isDeleted && actions.editorLabel !== null },
    { label: "Open with default program", action: () => actions.openDefault(file.path), isEnabled: !isDeleted && isSingle },
  );
  return items;
}

export function changesListMenu(actions: ChangesListMenuActions): MenuItem[] {
  return [
    { label: "Discard all changes…", action: actions.discardAll, isEnabled: actions.hasChanges },
    { label: "Stash all changes", action: actions.stashAll, isEnabled: actions.canStash },
  ];
}

export function commitMenu(actions: CommitMenuActions): MenuItem[] {
  return [
    { label: "Checkout commit", action: actions.checkout, isEnabled: !actions.isCurrent },
    { label: "Revert changes in commit", action: actions.revert },
    SEPARATOR,
    { label: "Create branch from commit", action: actions.createBranch },
    SEPARATOR,
    { label: "Cherry-pick commit…", action: actions.cherryPick, isEnabled: actions.canCherryPick },
    SEPARATOR,
    { label: "Copy SHA", action: () => actions.copy(actions.id) },
    { label: "View on GitHub", action: actions.viewOnGitHub, isEnabled: actions.hasGitHubRemote },
  ];
}
