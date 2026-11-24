import { GitBranchIcon, PlusIcon, RepoIcon } from "@primer/octicons-react";
import {
  AlertCircle, ChevronDown, Download, FileDiff, FolderGit2, FolderOpen, FolderPlus, GitCommitHorizontal, LoaderCircle, SquareTerminal, X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccountAvatar } from "./accounts/AccountAvatar";
import { useGitHubAccounts } from "./accounts/useGitHubAccounts";
import { BranchMenu } from "./components/BranchMenu";
import { MenuBar } from "./components/MenuBar";
import { PullRequestButton } from "./components/PullRequestButton";
import { ComparePanel } from "./components/ComparePanel";
import { RecoveryBar } from "./components/RecoveryBar";
import { SyncButton } from "./components/SyncButton";
import { ToolbarButton } from "./components/ToolbarButton";
import { Changes } from "./components/Changes";
import { History } from "./components/History";
import { RepositoryPicker } from "./components/RepositoryPicker";
import { CHANGES, HISTORY } from "./components/sidebar.constants";
import { useSidebar } from "./components/useSidebar";
import { WorkspaceDialog } from "./components/WorkspaceDialog";
import { appMenus } from "./git/app-menu.helpers";
import { git } from "./git/client";
import { useExternalEditor } from "./git/useExternalEditor";
import { DiffViewContext } from "./git/DiffViewContext";
import { DIFF_OPTIONS_KEY, DIFF_VIEW_KEY } from "./git/diff-view.constants";
import { readDiffOptions } from "./git/diff-view.helpers";
import type { DiffOptions } from "./git/bindings";
import type { DiffView } from "./git/diff-view.types";
import { EMPTY_DRAFT, THEME_KEY } from "./git/workspace.constants";
import { syncAction } from "./git/sync.helpers";
import { getTheme, messageOf, upstreamLabel } from "./git/workspace.helpers";
import type { DialogKind, Draft, View } from "./git/workspace.types";
import { useRepositoryMenu } from "./git/useRepositoryMenu";
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
  const [diffOptions, setDiffOptions] = useState<DiffOptions>(() => readDiffOptions(localStorage.getItem(DIFF_OPTIONS_KEY)));
  const outputBox = useRef<HTMLPreElement>(null);
  const repo = workspace.selected;
  const recovery = useRecovery(repo?.id, workspace.revision);
  const isPaused = recovery?.kind != null;
  const status = workspace.snapshot?.status;
  const sync = workspace.snapshot?.sync;
  const isBusy = Boolean(workspace.operation);
  const action = status && sync ? syncAction(status, sync) : null;
  const isRestoring = !workspace.hasRestored;
  const editorLabel = useExternalEditor();
  const repositoryMenu = useRepositoryMenu(workspace.entries, workspace.remove, workspace.setError);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => { localStorage.setItem(DIFF_VIEW_KEY, diffView); }, [diffView]);
  useEffect(() => { localStorage.setItem(DIFF_OPTIONS_KEY, JSON.stringify(diffOptions)); }, [diffOptions]);
  const diffViewSetting = useMemo(() => ({ diffView, changeDiffView: setDiffView, options: diffOptions, changeOptions: setDiffOptions }), [diffView, diffOptions]);

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
    requestAnimationFrame(() => document.querySelector<HTMLElement>(".menu-bar-item")?.focus());
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

  const reportFailure = (reason: unknown) => workspace.setError(messageOf(reason));
  const menus = appMenus({
    hasRepository: Boolean(repo), isBusy, hasGitHubRemote: repo ? repositoryMenu.hasGitHubRemote(repo.id) : false, editorLabel,
    syncTitle: action?.title ?? null,
    newRepository: () => showDialog("init"), addRepository: () => showDialog("open"), cloneRepository: () => showDialog("clone"),
    openSettings: () => setSettings("appearance"), openAccounts: () => setSettings("accounts"), switchRepository: () => setIsPickerOpen(true),
    refresh: workspace.refresh, openTerminal,
    showInFiles: () => { if (repo) void git.reveal(repo.id).catch(reportFailure); },
    openInEditor: () => { if (repo) void git.openInEditor(repo.id).catch(reportFailure); },
    viewOnGitHub: () => { if (repo) void git.openOnGitHub(repo.id).catch(reportFailure); },
    openBranches: () => setIsBranchOpen(true), compareBranches: () => setIsComparing(true), sync: activateSync,
  });
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
    <DiffViewContext.Provider value={diffViewSetting}><div className="app-frame">
      <div className="workspace-page" hidden={settings !== null}>
        <MenuBar menus={menus} isDisabled={isRestoring} />
        <header className="workspace-bar" aria-label="Workspace toolbar" style={sidebar.layout}>
          <h1 className={`repository-heading${sidebar.isCollapsed ? " is-folded" : ""}`}>
            <ToolbarButton className="repository-control" layout="subtitle" isDropdown icon={<RepoIcon />}
              text={repo?.name ?? "Choose a repository"} description="Current repository"
              aria-label="Switch repository" title={repo ? `${repo.path} (Ctrl+K)` : "Switch repository (Ctrl+K)"}
              onClick={() => setIsPickerOpen((value) => !value)} disabled={isRestoring}
              onContextMenu={(event) => { if (repo) repositoryMenu.show(event, repo); }} aria-expanded={isPickerOpen} aria-controls="repository-picker" />
          </h1>
          {isPickerOpen && <RepositoryPicker entries={workspace.entries} selected={repo?.id} choose={chooseRepo}
            open={() => showDialog("open")} clone={() => showDialog("clone")} init={() => showDialog("init")}
            close={() => setIsPickerOpen(false)} isBusy={isBusy} showMenu={repositoryMenu.show} />}
          <div className="bar-divider" aria-hidden="true" />
          <div className="workspace-bar-main">
            {repo && (
              <>
                <div className="branch-anchor">
                  <ToolbarButton ref={branchButton} className="branch-control" layout="subtitle" isDropdown icon={<GitBranchIcon />}
                    text={branch} description="Current branch" aria-label="Branches"
                    title={hasBranch && status ? upstreamLabel(status, sync ?? null) : branch}
                    disabled={isBusy || !status} onClick={() => setIsBranchOpen((value) => !value)} aria-expanded={isBranchOpen} aria-controls="branch-menu" />
                  {isBranchOpen && <BranchMenu repo={repo.id} current={status?.branch ?? null} isBusy={isBusy || isPaused}
                    close={closeBranchMenu} run={workspace.mutate} compare={() => setIsComparing(true)} />}
                </div>
                {action && status ? <SyncButton action={action} status={status} fetchRemote={sync?.fetchRemote ?? null}
                  lastFetch={workspace.lastFetch} isBusy={isBusy} activate={activateSync} fetch={fetchRemote} /> : null}
                {sync?.remotes.length === 0 ? <div className="toolbar-sync">
                  <ToolbarButton className="sync-control" icon={<PlusIcon />} text="Add remote" description="No remote configured"
                    disabled={isBusy} onClick={() => showDialog("addRemote")} />
                </div> : null}
                <PullRequestButton repo={repo.id} branch={status?.branch ?? null} hasUpstream={sync?.hasConfiguredUpstream ?? false}
                  hasGitHubRemote={repositoryMenu.hasGitHubRemote(repo.id)} onError={workspace.setError} />
              </>
            )}
            <span className="spacer" />
            <button type="button" className="toolbar-icon-button account-trigger" aria-label="Manage GitHub accounts"
              title={accounts.active?.login ? `GitHub account: ${accounts.active.login}` : "GitHub accounts"}
              onClick={() => setSettings("accounts")}>
              <AccountAvatar login={accounts.active?.login} />
              {accounts.active?.login ? <span className="sr-only">{accounts.active.login}</span> : null}
            </button>
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
                  <div className="row">
                    <button className="button primary" disabled={isBusy} onClick={() => showDialog("open")}><FolderOpen size={16} /> Open repository</button>
                    <button className="button" disabled={isBusy} onClick={() => showDialog("clone")}><Download size={16} /> Clone repository</button>
                    <button className="button" disabled={isBusy} onClick={() => showDialog("init")}><FolderPlus size={16} /> New repository</button>
                  </div>
                </>}
              </div>
            ) : (
              <>
                {recovery?.kind && <RecoveryBar repo={repo.id} recovery={{ ...recovery, kind: recovery.kind }} isBusy={isBusy} run={workspace.mutate} openTerminal={openTerminal} />}
                {isComparing && <ComparePanel key={repo.id} repo={repo.id} current={status?.branch ?? null}
                  upstream={status?.upstream ?? null} revision={workspace.revision}
                  isBusy={isBusy} isDirty={Boolean(status?.files.length)} isPaused={isPaused} run={workspace.mutate}
                  openChanges={() => { setView("changes"); setIsComparing(false); }} close={() => setIsComparing(false)} />}
                <div className="workspace-view" hidden={isComparing}>
                  {view === "history" ? (
                    <History key={repo.id} sidebar={sidebar} repo={repo.id} revision={workspace.revision} tabs={viewTabs} current={status?.branch ?? null}
                      isBusy={isBusy} isDirty={Boolean(status?.files.length)} isPaused={isPaused} run={workspace.mutate}
                      hasGitHubRemote={repositoryMenu.hasGitHubRemote(repo.id)} report={workspace.setError} />
                  ) : status ? (
                    <Changes key={repo.id} sidebar={sidebar} repo={repo.id} repositoryPath={repo.path} report={workspace.setError} status={status} revision={workspace.revision} isBusy={isBusy}
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
      {repositoryMenu.node}
      {settings && <SettingsPage section={settings} selectSection={setSettings} close={closeSettings}
        theme={theme} changeTheme={setTheme} diffView={diffView} changeDiffView={setDiffView} repositoryId={repo?.id} accountState={accounts.state}
        accountError={accounts.error} refreshAccounts={accounts.refresh} isWorkspaceBusy={isBusy} />}
      {dialog && (
        <WorkspaceDialog key={dialog} kind={dialog} status={status} sync={sync} error={workspace.error}
          close={() => setDialog(null)} open={workspace.open} clone={workspace.clone} init={workspace.init}
          isBusy={isBusy} run={workspace.mutate} />
      )}
    </div></DiffViewContext.Provider>
  );
}
