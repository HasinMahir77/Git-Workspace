import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useContextMenu } from "../components/useContextMenu";
import type { RepositoryInfo } from "./bindings";
import { git } from "./client";
import { copyText } from "./clipboard.helpers";
import { repositoryMenu } from "./menu.helpers";
import { useExternalEditor } from "./useExternalEditor";
import { messageOf } from "./workspace.helpers";

export function useRepositoryMenu(entries: RepositoryInfo[], remove: (id: string) => void, report: (message: string) => void) {
  const menu = useContextMenu();
  const editorLabel = useExternalEditor();
  const [githubRemotes, setGithubRemotes] = useState<Record<string, boolean>>({});
  const [removing, setRemoving] = useState<RepositoryInfo | null>(null);

  useEffect(() => {
    for (const entry of entries) {
      if (entry.id in githubRemotes) continue;
      void git.hasGitHubRemote(entry.id).then((has) => setGithubRemotes((known) => ({ ...known, [entry.id]: has })))
        .catch(() => setGithubRemotes((known) => ({ ...known, [entry.id]: false })));
    }
  }, [entries, githubRemotes]);

  const attempt = (work: Promise<void>) => void work.catch((reason: unknown) => report(messageOf(reason)));

  return {
    hasGitHubRemote: (id: string) => githubRemotes[id] === true,
    show: (event: MouseEvent, entry: RepositoryInfo) => menu.open(event, repositoryMenu({
      entry, editorLabel, hasGitHubRemote: githubRemotes[entry.id] === true,
      copy: (text) => void copyText(text),
      viewOnGitHub: () => attempt(git.openOnGitHub(entry.id)),
      openInTerminal: () => attempt(git.terminal(entry.id)),
      showInFiles: () => attempt(git.reveal(entry.id)),
      openInEditor: () => attempt(git.openInEditor(entry.id)),
      remove: () => setRemoving(entry),
    })),
    node: <>
      {menu.node}
      {removing && (
        <ConfirmDialog title="Remove repository" confirmLabel="Remove" isDanger close={() => setRemoving(null)} confirm={() => remove(removing.id)}>
          <p>Remove <strong>{removing.name}</strong> from Git Workspace?</p>
          <p className="muted">The repository stays on your disk and can be added again later.</p>
        </ConfirmDialog>
      )}
    </>,
  };
}
