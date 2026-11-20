import {
  AlertCircle, ArrowDown, ArrowUp, ChevronDown, CircleHelp, Download, FileDiff, FolderGit2,
  GitBranch, GitCommitHorizontal, GitFork, LoaderCircle, RefreshCw, SquareTerminal, UserRound, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AccountDialog } from "./accounts/AccountDialog";
import { useGitHubAccounts } from "./accounts/useGitHubAccounts";
import { Changes } from "./components/Changes";
import { History } from "./components/History";
import { WorkspaceDialog } from "./components/WorkspaceDialog";
import { git } from "./git/client";
import { EMPTY_DRAFT, THEME_KEY } from "./git/workspace.constants";
import { getTheme, messageOf, syncAction, upstreamLabel } from "./git/workspace.helpers";
import type { DialogKind, Draft, View } from "./git/workspace.types";
import { useWorkspace } from "./git/useWorkspace";

export function App() {
  const workspace = useWorkspace();
  const accounts = useGitHubAccounts();
  const [areAccountsOpen, setAreAccountsOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [view, setView] = useState<View>("changes");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [theme, setTheme] = useState(() => getTheme(localStorage.getItem(THEME_KEY)));
  const outputBox = useRef<HTMLPreElement>(null);
  const repo = workspace.selected;
  const status = workspace.snapshot?.status;
  const sync = workspace.snapshot?.sync;
  const isBusy = Boolean(workspace.operation);
  const action = status && sync ? syncAction(status, sync) : null;

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const output = outputBox.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [workspace.output, workspace.hasOutputOpen]);

  function showDialog(kind: DialogKind) {
    workspace.setError("");
    setDialog(kind);
  }

  function fetchRemote() {
    if (!sync?.fetchRemote) return;
    if (sync.remotes.length > 1) {
      showDialog("fetch");
    } else {
      void workspace.mutate({ type: "fetch", remote: sync.fetchRemote }, "Fetch");
    }
  }

  function activateSync() {
    if (!action) return;
    if (action.kind === "fetch") fetchRemote();
    else if (action.kind === "pull") void workspace.mutate({ type: "pull" }, "Pull");
    else showDialog(action.kind);
  }

  const SyncIcon = action?.kind === "pull" ? ArrowDown : action?.kind === "push" || action?.kind === "publish" ? ArrowUp : Download;
  return (
    <div className="shell">
      <aside className="rail" aria-label="Repositories and settings">
        <div className="brand"><span className="brand-mark"><GitFork size={17} aria-hidden="true" /></span> Git Workspace</div>
        <div className="rail-heading">
          <strong>Repositories</strong>
          <button className="button icon subtle" aria-label="Open a repository folder" title="Open a repository folder" disabled={isBusy || !workspace.hasRestored} onClick={() => showDialog("open")}><FolderGit2 size={16} /></button>
        </div>
        <nav className="rail-list" aria-label="Repositories">
          {workspace.entries.map((entry) => (
            <button className="repo row" key={entry.id} aria-current={entry.id === repo?.id ? "true" : undefined} title={entry.path}
              onClick={() => { workspace.select(entry.id); setView("changes"); }}>
              <FolderGit2 size={16} aria-hidden="true" /><span className="truncate">{entry.name}</span>
            </button>
          ))}
        </nav>
        <div className="rail-actions">
          <button className="button account-trigger" aria-label="Manage GitHub accounts" disabled={isBusy} onClick={() => setAreAccountsOpen(true)}>
            <span className="account-avatar"><UserRound size={16} aria-hidden="true" /></span>
            <span className="account-details truncate">
              <strong className="truncate" title={accounts.active?.login}>
                {accounts.active?.login ?? (accounts.state ? "Sign in to GitHub" : "GitHub accounts")}
              </strong>
              <small>{accounts.active ? (accounts.active.isAuthenticated ? "GitHub CLI" : "Sign-in needs attention") : "Manage accounts"}</small>
            </span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          <button className="button" disabled={isBusy || !workspace.hasRestored} onClick={() => showDialog("clone")}><Download size={15} /> Clone repository</button>
          <button className="button subtle" onClick={() => showDialog("environment")}><CircleHelp size={15} /> Git environment</button>
          <label className="theme-label"><small>Theme</small>
            <select aria-label="Theme" className="field" value={theme} onChange={(event) => setTheme(getTheme(event.target.value))}>
              <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </aside>
      <main className="workspace">
        {repo && (
          <>
            <header className="workspace-header">
              <div className="repository-title truncate">
                <h1 className="truncate" title={repo.path}>{repo.name}</h1>
                <div className="branch-status muted">
                  <GitBranch size={13} aria-hidden="true" />
                  <span className="truncate" title={status?.branch ?? undefined}>{status?.branch ?? (status ? "Detached HEAD" : "Reading branch…")}</span>
                  {status?.branch && <small className="truncate">· {upstreamLabel(status, sync ?? null)}</small>}
                </div>
              </div>
              <span className="spacer" />
              <button className="button" disabled={isBusy || !status} onClick={() => showDialog("branches")}><GitBranch size={15} /> Branches <ChevronDown size={13} /></button>
              {action && <button className="button primary" disabled={isBusy} onClick={activateSync}><SyncIcon size={15} /> {action.label}</button>}
              {action && action.kind !== "fetch" && <button className="button icon" disabled={isBusy} onClick={fetchRemote} title="Fetch" aria-label="Fetch"><Download size={16} /></button>}
              <button className="button icon" disabled={isBusy} onClick={workspace.refresh} title="Refresh working tree" aria-label="Refresh working tree"><RefreshCw size={15} /></button>
              <button className="button icon" title="Open in Terminal" aria-label="Open in Terminal"
                onClick={() => void git.terminal(repo.id).catch((reason: unknown) => workspace.setError(messageOf(reason)))}><SquareTerminal size={16} /></button>
            </header>
            <nav className="view-tabs" aria-label="Repository views">
              <button className="view-tab" aria-pressed={view === "changes"} onClick={() => setView("changes")}>
                <FileDiff size={15} /> Changes {status && <span className="count">{status.files.length}</span>}
              </button>
              <button className="view-tab" aria-pressed={view === "history"} onClick={() => setView("history")}><GitCommitHorizontal size={15} /> History</button>
              <span className="spacer" />
              {workspace.lastFetch && <small className="fetched">Fetched at {workspace.lastFetch}</small>}
            </nav>
          </>
        )}
        {workspace.error && !dialog && (
          <div className="banner" role="alert">
            <AlertCircle size={17} aria-hidden="true" /><p>{workspace.error}</p>
            <button className="button icon subtle" aria-label="Dismiss error" onClick={() => workspace.setError("")}><X size={15} /></button>
          </div>
        )}
        {!repo ? (
          <div className="empty landing">
            <FolderGit2 size={38} aria-hidden="true" />
            <h1>{workspace.hasRestored ? "Open a Git repository" : "Loading repositories"}</h1>
            {workspace.hasRestored && <>
              <p className="muted">Add a local checkout or clone a repository to get started.</p>
              <button className="button primary" disabled={isBusy} onClick={() => showDialog("open")}><FolderGit2 size={16} /> Open repository</button>
            </>}
          </div>
        ) : view === "history" ? (
          <History key={repo.id} repo={repo.id} revision={workspace.revision} />
        ) : status ? (
          <Changes key={repo.id} repo={repo.id} status={status} revision={workspace.revision} isBusy={isBusy}
            draft={drafts[repo.id] ?? EMPTY_DRAFT} changeDraft={(draft) => setDrafts((current) => ({ ...current, [repo.id]: draft }))}
            run={workspace.mutate} />
        ) : (
          <div className="empty"><FolderGit2 size={25} /><h2>{workspace.error ? "Repository unavailable" : "Loading changes"}</h2></div>
        )}
        {(workspace.output || isBusy || workspace.hasOutputOpen) && (
          <section className="output-panel" aria-label="Git operation output">
            <div className="row">
              <button className="button subtle" aria-expanded={workspace.hasOutputOpen}
                onClick={() => workspace.setHasOutputOpen((value) => !value)}><SquareTerminal size={15} /> Operation output <ChevronDown size={13} /></button>
              {isBusy && <span className="row muted" role="status"><LoaderCircle size={14} className="spinning" />{workspace.operation} in progress</span>}
              {workspace.canCancel && <button type="button" className="button subtle" disabled={workspace.isCancelling}
                onClick={() => void workspace.cancel()}>{workspace.isCancelling ? "Cancelling…" : "Cancel operation"}</button>}
            </div>
            {workspace.hasOutputOpen && <pre ref={outputBox} tabIndex={0}>{workspace.output || (isBusy ? "Waiting for Git output…" : "")}</pre>}
          </section>
        )}
      </main>
      {areAccountsOpen && <AccountDialog accountState={accounts.state} loadError={accounts.error}
        refresh={accounts.refresh} close={() => setAreAccountsOpen(false)} />}
      {dialog && (
        <WorkspaceDialog key={dialog} kind={dialog} repo={repo?.id} status={status} sync={sync} error={workspace.error}
          close={() => setDialog(null)} open={workspace.open} clone={workspace.clone} isBusy={isBusy} run={workspace.mutate} />
      )}
    </div>
  );
}
