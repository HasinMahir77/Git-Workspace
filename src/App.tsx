import {
  AlertCircle, ArrowDown, ArrowUp, ChevronDown, Download, FileDiff, FolderGit2, FolderOpen,
  GitBranch, GitCommitHorizontal, LoaderCircle, RefreshCw, Settings, SquareTerminal, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AccountAvatar } from "./accounts/AccountAvatar";
import { useGitHubAccounts } from "./accounts/useGitHubAccounts";
import { BranchMenu } from "./components/BranchMenu";
import { ComparePanel } from "./components/ComparePanel";
import { RecoveryBar } from "./components/RecoveryBar";
import { Changes } from "./components/Changes";
import { History } from "./components/History";
import { RepositoryPicker } from "./components/RepositoryPicker";
import { CHANGES, HISTORY } from "./components/sidebar.constants";
import { useSidebar } from "./components/useSidebar";
import { WorkspaceDialog } from "./components/WorkspaceDialog";
import { git } from "./git/client";
import { DiffViewContext } from "./git/DiffViewContext";
import { DIFF_VIEW_KEY } from "./git/diff-view.constants";
import type { DiffView } from "./git/diff-view.types";
import { EMPTY_DRAFT, THEME_KEY } from "./git/workspace.constants";
import { getTheme, messageOf, syncAction, upstreamLabel } from "./git/workspace.helpers";
import type { DialogKind, Draft, View } from "./git/workspace.types";
import { useRecovery } from "./git/useRecovery";
import { useWorkspace } from "./git/useWorkspace";
import { SettingsPage } from "./settings/SettingsPage";
import type { SettingsSection } from "./settings/settings.types";

export function App() {
  const workspace = useWorkspace();
  const accounts = useGitHubAccounts();
  const [settings, setSettings] = useState<SettingsSection | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const branchButton = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [view, setView] = useState<View>("changes");
  const changesSidebar = useSidebar(CHANGES);
  const historySidebar = useSidebar(HISTORY);
  const sidebar = view === "history" ? historySidebar : changesSidebar;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [theme, setTheme] = useState(() => getTheme(localStorage.getItem(THEME_KEY)));
  const [diffView, setDiffView] = useState<DiffView>(() => localStorage.getItem(DIFF_VIEW_KEY) === "split" ? "split" : "unified");
  const outputBox = useRef<HTMLPreElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const repo = workspace.selected;
  const recovery = useRecovery(repo?.id, workspace.revision);
  const isPaused = recovery?.kind != null;
  const status = workspace.snapshot?.status;
  const sync = workspace.snapshot?.sync;
  const isBusy = Boolean(workspace.operation);
  const action = status && sync ? syncAction(status, sync) : null;
  const isRestoring = !workspace.hasRestored;

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => { localStorage.setItem(DIFF_VIEW_KEY, diffView); }, [diffView]);

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
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
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

  function closeBranchMenu(shouldFocus = false) {
    setIsBranchOpen(false);
    if (shouldFocus) branchButton.current?.focus();
  }

  function showDialog(kind: DialogKind) {
    workspace.setError("");
    setIsPickerOpen(false);
    setIsBranchOpen(false);
    setDialog(kind);
  }

  function chooseRepo(id: string) {
    if (repo?.id !== id) {
      workspace.select(id);
      setView("changes");
      setIsComparing(false);
    }
    setIsPickerOpen(false);
    setIsBranchOpen(false);
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
    <DiffViewContext.Provider value={diffView}><div className="app-frame">
      <div className="workspace-page" hidden={settings !== null}>
        <header className="workspace-bar" aria-label="Workspace toolbar" style={sidebar.layout}>
          <h1 className={`repository-heading truncate${sidebar.isCollapsed ? " is-folded" : ""}`}>
            <button className="toolbar-cell repository-control" aria-label="Switch repository" title="Switch repository (Ctrl+K)"
              onClick={() => setIsPickerOpen((value) => !value)} disabled={isRestoring} aria-expanded={isPickerOpen} aria-controls="repository-picker">
              <FolderGit2 size={18} aria-hidden="true" />
              <span className="toolbar-text truncate"><small>Current repository</small><strong className="truncate" title={repo?.path}>{repo?.name ?? "Choose a repository"}</strong></span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
          </h1>
          {isPickerOpen && <RepositoryPicker entries={workspace.entries} selected={repo?.id} choose={chooseRepo}
            open={() => showDialog("open")} clone={() => showDialog("clone")} close={() => setIsPickerOpen(false)} isBusy={isBusy} />}
          <div className="bar-divider" aria-hidden="true" />
          <div className="workspace-bar-main">
          {repo && (
            <>
              <div className="branch-anchor">
              <button ref={branchButton} className="toolbar-cell branch-control" aria-label="Branches" title={hasBranch && status ? upstreamLabel(status, sync ?? null) : branch}
                disabled={isBusy || !status} onClick={() => setIsBranchOpen((value) => !value)} aria-expanded={isBranchOpen} aria-controls="branch-menu">
                <GitBranch size={17} aria-hidden="true" />
                <span className="toolbar-text truncate">
                  <small className="truncate">{status?.upstream ? upstreamLabel(status, sync ?? null) : "Current branch"}</small>
                  <strong className="truncate">{branch}</strong>
                </span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {isBranchOpen && <BranchMenu repo={repo.id} current={status?.branch ?? null} isBusy={isBusy || isPaused}
                close={closeBranchMenu} run={workspace.mutate} compare={() => setIsComparing(true)} />}
              </div>
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
          </div>
        </header>
        <div className="shell">
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
            ) : (
              <>
                {recovery?.kind && <RecoveryBar recovery={{ ...recovery, kind: recovery.kind }} isBusy={isBusy} run={workspace.mutate} openTerminal={openTerminal} />}
                {isComparing && <ComparePanel key={repo.id} repo={repo.id} current={status?.branch ?? null}
                  upstream={status?.upstream ?? null} revision={workspace.revision}
                  isBusy={isBusy} isDirty={Boolean(status?.files.length)} isPaused={isPaused} run={workspace.mutate}
                  openChanges={() => { setView("changes"); setIsComparing(false); }} close={() => setIsComparing(false)} />}
                <div className="workspace-view" hidden={isComparing}>
                  {view === "history" ? (
                    <History key={repo.id} sidebar={sidebar} repo={repo.id} revision={workspace.revision} tabs={viewTabs} current={status?.branch ?? null}
                      isBusy={isBusy} isDirty={Boolean(status?.files.length)} isPaused={isPaused} run={workspace.mutate} />
                  ) : status ? (
                    <Changes key={repo.id} sidebar={sidebar} repo={repo.id} status={status} revision={workspace.revision} isBusy={isBusy}
                      tabs={viewTabs} viewHistory={() => setView("history")} openTerminal={openTerminal}
                      draft={drafts[repo.id] ?? EMPTY_DRAFT} changeDraft={(draft) => setDrafts((current) => ({ ...current, [repo.id]: draft }))}
                      run={workspace.mutate} />
                  ) : (
                    <div className="empty"><FolderGit2 size={25} /><h2>{workspace.error ? "Repository unavailable" : "Loading changes"}</h2></div>
                  )}
                </div>
              </>
            )}
            {(workspace.output || isBusy || workspace.hasOutputOpen) && (
              <section className="output-panel" aria-label="Git operation output">
                <div className="row">
                  <button className="button subtle" aria-expanded={workspace.hasOutputOpen}
                    onClick={() => workspace.setHasOutputOpen((value) => !value)}><SquareTerminal size={15} /> {workspace.output && !isBusy ? "Last output" : "Operation output"} <ChevronDown size={13} /></button>
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
        theme={theme} changeTheme={setTheme} diffView={diffView} changeDiffView={setDiffView} repositoryId={repo?.id} accountState={accounts.state}
        accountError={accounts.error} refreshAccounts={accounts.refresh} isWorkspaceBusy={isBusy} />}
      {dialog && (
        <WorkspaceDialog key={dialog} kind={dialog} repo={repo?.id} status={status} sync={sync} error={workspace.error}
          close={() => setDialog(null)} open={workspace.open} clone={workspace.clone} isBusy={isBusy} run={workspace.mutate} />
      )}
    </div></DiffViewContext.Provider>
  );
}
