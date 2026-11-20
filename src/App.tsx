import {
  AlertCircle, ArrowDown, ArrowUp, ChevronDown, Download, FileDiff, FolderGit2, FolderOpen,
  GitBranch, GitCommitHorizontal, LoaderCircle, RefreshCw, Settings, SquareTerminal, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AccountAvatar } from "./accounts/AccountAvatar";
import { useGitHubAccounts } from "./accounts/useGitHubAccounts";
import { Changes } from "./components/Changes";
import { History } from "./components/History";
import { RepositoryPicker } from "./components/RepositoryPicker";
import { RAIL } from "./components/sidebar.constants";
import { SidebarDivider, SidebarToggle } from "./components/SidebarControls";
import { useSidebar } from "./components/useSidebar";
import { WorkspaceDialog } from "./components/WorkspaceDialog";
import { git } from "./git/client";
import { EMPTY_DRAFT, THEME_KEY } from "./git/workspace.constants";
import { getTheme, messageOf, syncAction, upstreamLabel } from "./git/workspace.helpers";
import type { DialogKind, Draft, View } from "./git/workspace.types";
import { useWorkspace } from "./git/useWorkspace";
import { SettingsPage } from "./settings/SettingsPage";
import type { SettingsSection } from "./settings/settings.types";

export function App() {
  const sidebar = useSidebar(RAIL);
  const workspace = useWorkspace();
  const accounts = useGitHubAccounts();
  const [settings, setSettings] = useState<SettingsSection | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [view, setView] = useState<View>("changes");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [theme, setTheme] = useState(() => getTheme(localStorage.getItem(THEME_KEY)));
  const outputBox = useRef<HTMLPreElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const repo = workspace.selected;
  const status = workspace.snapshot?.status;
  const sync = workspace.snapshot?.sync;
  const isBusy = Boolean(workspace.operation);
  const action = status && sync ? syncAction(status, sync) : null;
  const isRestoring = !workspace.hasRestored;

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const output = outputBox.current;
    if (output) output.scrollTop = output.scrollHeight;
  }, [workspace.output, workspace.hasOutputOpen, settings]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || dialog || isPickerOpen) return;
      if (event.key === "Escape" && settings) {
        closeSettings();
        return;
      }
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) return;
      if (event.key === ",") {
        event.preventDefault();
        setSettings("appearance");
      } else if (!settings && !isRestoring && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsPickerOpen(true);
      } else if (!settings && !isRestoring && !isBusy && event.key.toLowerCase() === "o") {
        event.preventDefault();
        setDialog("open");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog, isPickerOpen, settings, isRestoring, isBusy]);

  function closeSettings() {
    setSettings(null);
    requestAnimationFrame(() => settingsButton.current?.focus());
  }

  function showDialog(kind: DialogKind) {
    workspace.setError("");
    setIsPickerOpen(false);
    setDialog(kind);
  }

  function chooseRepo(id: string) {
    if (repo?.id !== id) {
      workspace.select(id);
      setView("changes");
    }
    setIsPickerOpen(false);
  }

  function openTerminal() {
    if (repo) void git.terminal(repo.id).catch((reason: unknown) => workspace.setError(messageOf(reason)));
  }

  function fetchRemote() {
    if (!sync?.fetchRemote) return;
    if (sync.remotes.length > 1) showDialog("fetch");
    else void workspace.mutate({ type: "fetch", remote: sync.fetchRemote }, "Fetch");
  }

  function activateSync() {
    if (!action) return;
    if (action.kind === "fetch") fetchRemote();
    else if (action.kind === "pull") void workspace.mutate({ type: "pull" }, "Pull");
    else showDialog(action.kind);
  }

  const SyncIcon = action?.kind === "pull" ? ArrowDown : action?.kind === "push" || action?.kind === "publish" ? ArrowUp : RefreshCw;
  const hasBranch = Boolean(status?.branch);
  const branch = status?.branch ?? (status ? "Detached HEAD" : "Reading branch…");
  const viewTabs = (
    <nav className="view-tabs" aria-label="Repository views">
      <button className="view-tab" aria-label="Changes" aria-pressed={view === "changes"} onClick={() => setView("changes")}>
        <FileDiff size={15} aria-hidden="true" /><span className="view-tab-label">Changes</span>
        {Boolean(status?.files.length) && <span className="count">{status?.files.length}</span>}
      </button>
      <button className="view-tab" aria-label="History" aria-pressed={view === "history"} onClick={() => setView("history")}>
        <GitCommitHorizontal size={15} aria-hidden="true" /><span className="view-tab-label">History</span>
      </button>
    </nav>
  );

  return (
    <div className="app-frame">
      <div className="workspace-page" hidden={settings !== null}>
        <header className="workspace-bar" aria-label="Workspace toolbar">
          <SidebarToggle sidebar={sidebar} />
          <h1 className="repository-heading truncate">
            <button className="toolbar-cell repository-control" aria-label="Switch repository" title="Switch repository (Ctrl+K)"
              onClick={() => setIsPickerOpen(true)} disabled={isRestoring} aria-haspopup="dialog">
              <FolderGit2 size={18} aria-hidden="true" />
              <span className="toolbar-text truncate"><small>Repository</small><strong className="truncate" title={repo?.path}>{repo?.name ?? "Choose a repository"}</strong></span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          </h1>
          {repo && (
            <>
              <button className="toolbar-cell branch-control" aria-label="Branches" title={hasBranch && status ? upstreamLabel(status, sync ?? null) : branch}
                disabled={isBusy || !status} onClick={() => showDialog("branches")} aria-haspopup="dialog">
                <GitBranch size={17} aria-hidden="true" />
                <span className="toolbar-text truncate">
                  <small className="truncate">{status?.upstream ? upstreamLabel(status, sync ?? null) : "Branch"}</small>
                  <strong className="truncate">{branch}</strong>
                </span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {action && <button className="toolbar-cell sync-control" disabled={isBusy} onClick={activateSync} aria-label={action.label}>
                <SyncIcon size={17} aria-hidden="true" />
                <span className="toolbar-text truncate"><strong>{action.label}</strong>
                  {workspace.lastFetch && <small className="truncate">Fetched at {workspace.lastFetch}</small>}
                </span>
              </button>}
            </>
          )}
          <span className="spacer" />
          {repo && (
            <div className="toolbar-tools row" aria-label="Repository tools">
              {action && action.kind !== "fetch" && <button className="button icon subtle" disabled={isBusy} onClick={fetchRemote} title="Fetch" aria-label="Fetch"><Download size={16} /></button>}
              <button className="button icon subtle" disabled={isBusy} onClick={workspace.refresh} title="Refresh working tree" aria-label="Refresh working tree"><RefreshCw size={16} /></button>
              <button className="button icon subtle" title="Open in Terminal" aria-label="Open in Terminal" onClick={openTerminal}><SquareTerminal size={16} /></button>
            </div>
          )}
          <div className="toolbar-tools toolbar-settings row">
            <button className="button icon subtle account-trigger" aria-label="Manage GitHub accounts"
              title={accounts.active?.login ? `GitHub account: ${accounts.active.login}` : "GitHub accounts"}
              onClick={() => setSettings("accounts")}>
              <AccountAvatar login={accounts.active?.login} />
              {accounts.active?.login && <span className="sr-only">{accounts.active.login}</span>}
            </button>
            <button className="button icon subtle" ref={settingsButton} aria-label="Settings" title="Settings (Ctrl+,)"
              onClick={() => setSettings("appearance")}><Settings size={18} /></button>
          </div>
        </header>
        <div className="shell" style={sidebar.layout}>
          <aside className="rail" aria-label="Repositories">
            <div className="rail-content" id={sidebar.panelId} hidden={sidebar.isCollapsed}>
              <div className="rail-heading">
                <strong>Repositories</strong>
                <button className="button icon subtle" aria-label="Open a repository folder" title="Open repository (Ctrl+O)"
                  disabled={isBusy || isRestoring} onClick={() => showDialog("open")}><FolderOpen size={16} /></button>
              </div>
              <nav className="rail-list" aria-label="Open repositories">
                {workspace.entries.map((entry) => (
                  <button className="repo row" key={entry.id} aria-current={entry.id === repo?.id ? "true" : undefined} title={entry.path}
                    onClick={() => chooseRepo(entry.id)}>
                    <FolderGit2 size={16} aria-hidden="true" /><span className="truncate">{entry.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>
          <SidebarDivider sidebar={sidebar} />
          <main className="workspace">
            {workspace.error && !dialog && (
              <div className="banner" role="alert">
                <AlertCircle size={17} aria-hidden="true" /><p>{workspace.error}</p>
                <button className="button icon subtle" aria-label="Dismiss error" onClick={() => workspace.setError("")}><X size={15} /></button>
              </div>
            )}
            {!repo ? (
              <div className="empty landing">
                <FolderGit2 size={36} aria-hidden="true" />
                <h2>{isRestoring ? "Loading repositories" : "Open a Git repository"}</h2>
                {!isRestoring && <>
                  <p className="muted">Open an existing checkout or clone a repository.</p>
                  <div className="row">
                    <button className="button primary" disabled={isBusy} onClick={() => showDialog("open")}><FolderOpen size={16} /> Open repository</button>
                    <button className="button" disabled={isBusy} onClick={() => showDialog("clone")}><Download size={16} /> Clone repository</button>
                  </div>
                </>}
              </div>
            ) : view === "history" ? (
              <History key={repo.id} repo={repo.id} revision={workspace.revision} tabs={viewTabs} />
            ) : status ? (
              <Changes key={repo.id} repo={repo.id} status={status} revision={workspace.revision} isBusy={isBusy}
                tabs={viewTabs} viewHistory={() => setView("history")} openTerminal={openTerminal}
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
        </div>
      </div>
      {settings && <SettingsPage section={settings} selectSection={setSettings} close={closeSettings}
        theme={theme} changeTheme={setTheme} repositoryId={repo?.id} accountState={accounts.state}
        accountError={accounts.error} refreshAccounts={accounts.refresh} isWorkspaceBusy={isBusy} />}
      {isPickerOpen && <RepositoryPicker entries={workspace.entries} selected={repo?.id} choose={chooseRepo}
        open={() => showDialog("open")} clone={() => showDialog("clone")} close={() => setIsPickerOpen(false)} isBusy={isBusy} />}
      {dialog && (
        <WorkspaceDialog key={dialog} kind={dialog} repo={repo?.id} status={status} sync={sync} error={workspace.error}
          close={() => setDialog(null)} open={workspace.open} clone={workspace.clone} isBusy={isBusy} run={workspace.mutate} />
      )}
    </div>
  );
}
