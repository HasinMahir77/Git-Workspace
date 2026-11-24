import { useContext, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { git } from "../git/client";
import type { Commit, CommitFile } from "../git/bindings";
import { copyText } from "../git/clipboard.helpers";
import { commitAge, commitDateTitle } from "../git/date.helpers";
import { DiffViewContext } from "../git/DiffViewContext";
import { commitMenu } from "../git/menu.helpers";
import { splitPath } from "../git/path.helpers";
import { HISTORY_PAGE_SIZE } from "../git/workspace.constants";
import { messageOf } from "../git/workspace.helpers";
import { ConfirmDialog } from "./ConfirmDialog";
import { CherryPickOnto } from "./CherryPickOnto";
import { CreateBranchDialog } from "./CreateBranchDialog";
import { DiffPanel } from "./DiffPanel";
import { FileStatusIcon } from "./FileStatusIcon";
import { FILE_KINDS, FILE_STATES } from "./changes.constants";
import type { HistoryProps } from "./history.types";
import { useContextMenu } from "./useContextMenu";
import { WorkspaceSplit } from "./WorkspaceSplit";

const SHORT_ID_LENGTH = 8;

export function History({ sidebar, repo, revision, tabs, current, isBusy, isDirty, isPaused, hasGitHubRemote, run, report }: HistoryProps) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selected, select] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<{ id: string; list: CommitFile[]; error?: string } | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ key: string; patch: string; error?: string } | null>(null);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [cherryFocus, setCherryFocus] = useState(0);
  const [branching, setBranching] = useState<Commit | null>(null);
  const [dragged, setDragged] = useState<Commit | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [squashing, setSquashing] = useState<{ commit: Commit; onto: Commit } | null>(null);
  const [picking, setPicking] = useState<{ commit: Commit; branch: string } | null>(null);
  const { options } = useContext(DiffViewContext);
  const now = Date.now();
  const menu = useContextMenu();
  const commit = commits.find((entry) => entry.id === selected) ?? commits[0];
  const id = commit?.id;
  const commitFiles = files !== null && files.id === id ? files.list : null;
  const file = commitFiles?.find((entry) => entry.path === selectedPath) ?? commitFiles?.[0];
  const diffKey = file ? `${id}:${file.path}:${options.shouldIgnoreWhitespace}:${options.contextLines}` : null;

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");
    void git.history(repo, 0).then((page) => {
      if (!isCurrent) return;
      setCommits(page);
      setHasMore(page.length === HISTORY_PAGE_SIZE);
    }).catch((reason: unknown) => {
      if (isCurrent) setError(messageOf(reason));
    }).finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [repo, revision]);

  useEffect(() => {
    let isCurrent = true;
    void git.branchGroups(repo).then((groups) => { if (isCurrent) setDestinations(groups.local.filter((name) => name !== current)); })
      .catch(() => { if (isCurrent) setDestinations([]); });
    return () => { isCurrent = false; };
  }, [repo, current, revision]);

  useEffect(() => {
    if (!id) return;
    let isCurrent = true;
    setSelectedPath(null);
    void git.commitFiles(repo, id).then((list) => {
      if (isCurrent) setFiles({ id, list });
    }).catch((reason: unknown) => {
      if (isCurrent) setFiles({ id, list: [], error: messageOf(reason) });
    });
    return () => { isCurrent = false; };
  }, [repo, id]);

  useEffect(() => {
    if (!id || !file || !diffKey) return;
    let isCurrent = true;
    const paths = file.originalPath ? [file.path, file.originalPath] : [file.path];
    void git.commitDiff(repo, id, paths, options).then((patch) => {
      if (isCurrent) setPreview({ key: diffKey, patch });
    }).catch((reason: unknown) => {
      if (isCurrent) setPreview({ key: diffKey, patch: "", error: messageOf(reason) });
    });
    return () => { isCurrent = false; };
  }, [repo, id, file?.path, file?.originalPath, diffKey, options]);

  async function loadMore() {
    setIsLoading(true);
    setError("");
    try {
      const page = await git.history(repo, commits.length);
      setCommits((previous) => [...previous, ...page.filter((entry) => !previous.some((existing) => existing.id === entry.id))]);
      setHasMore(page.length === HISTORY_PAGE_SIZE);
    } catch (reason: unknown) {
      setError(messageOf(reason));
    } finally {
      setIsLoading(false);
    }
  }

  function moveSelection(event: KeyboardEvent<HTMLElement>) {
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0 || !commit) return;
    const next = commits[commits.findIndex((entry) => entry.id === commit.id) + step];
    if (!next) return;
    event.preventDefault();
    select(next.id);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-commit="${next.id}"]`)?.focus());
  }

  function showCommitMenu(event: React.MouseEvent, target: Commit, index: number) {
    select(target.id);
    menu.open(event, commitMenu({
      id: target.id, isCurrent: index === 0, hasGitHubRemote, canCherryPick: !isPaused && !isBusy && destinations.length > 0,
      copy: (text) => void copyText(text),
      checkout: () => void run({ type: "checkoutCommit", commit: target.id }, "Checkout commit"),
      revert: () => void run({ type: "revertCommit", commit: target.id }, "Revert commit"),
      createBranch: () => setBranching(target),
      cherryPick: () => { select(target.id); setCherryFocus((value) => value + 1); },
      viewOnGitHub: () => void git.openOnGitHub(repo, target.id).catch((reason: unknown) => report(messageOf(reason))),
    }));
  }

  const canRewrite = !isPaused && !isBusy;

  function dropOn(target: Commit) {
    const source = dragged;
    setDragged(null);
    setDropId(null);
    if (!source || source.id === target.id || !canRewrite) return;
    if (commits.findIndex((entry) => entry.id === source.id) > commits.findIndex((entry) => entry.id === target.id)) {
      report("Drop a commit onto an older commit to squash them.");
      return;
    }
    if (isDirty) {
      report("Squash needs a clean working tree. Commit or stash your changes in Changes first.");
      return;
    }
    setSquashing({ commit: source, onto: target });
  }

  const summary = useMemo(() => commit && (
    <header className="commit-summary">
      <h2 className="truncate" title={commit.summary}>{commit.summary}</h2>
      <div className="commit-meta">
        <span>{commit.author}</span>
        <time dateTime={commit.date} title={commitDateTitle(commit.date)}>{commitAge(commit.date, now)}</time>
        <code title={commit.id}>{commit.id.slice(0, SHORT_ID_LENGTH)}</code>
        {commitFiles && <span>{commitFiles.length} changed {commitFiles.length === 1 ? "file" : "files"}</span>}
      </div>
    </header>
  ), [commit, commitFiles]);

  return (
    <WorkspaceSplit sidebar={sidebar} label="Commits" tabs={tabs} preview={
      <section className="history-detail" aria-label="Commit details">
        {summary}
        {commit && !isPaused && <CherryPickOnto commit={commit} destinations={destinations} focusKey={cherryFocus} isBusy={isBusy} isDirty={isDirty} run={run} />}
        <div className="commit-body">
          <div className="file-list commit-files" role="group" aria-label="Changed files in commit" onKeyDown={(event) => {
            const list = commitFiles ?? [];
            const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
            const next = file ? list[list.indexOf(file) + step] : undefined;
            if (step !== 0 && next) { event.preventDefault(); setSelectedPath(next.path); }
          }}>
            {files?.error && <div role="alert" className="banner"><p>{files.error}</p></div>}
            {commitFiles?.map((entry) => {
              const { directory, name } = splitPath(entry.path);
              return (
                <button key={entry.path} className={`file-row commit-file${entry === file ? " selected" : ""}`} aria-pressed={entry === file}
                  title={entry.originalPath ? `${entry.originalPath} → ${entry.path}` : entry.path} onClick={() => setSelectedPath(entry.path)}>
                  <span className="file-path truncate"><span className="file-directory">{directory}</span>{name}</span>
                  <FileStatusIcon kind={FILE_KINDS[entry.status] ?? "modified"} label={FILE_STATES[entry.status] ?? entry.status} />
                </button>
              );
            })}
          </div>
          <DiffPanel isHistory={false} title={file ? (file.originalPath ? `${file.originalPath} → ${file.path}` : file.path) : commit ? undefined : undefined}
            patch={diffKey && preview?.key === diffKey ? preview.patch : null} error={diffKey && preview?.key === diffKey ? preview.error : undefined}
            fileStatus={file ? { kind: FILE_KINDS[file.status] ?? "modified", label: FILE_STATES[file.status] ?? file.status } : undefined}
            emptyTitle={commit && commitFiles?.length === 0 ? "No files changed" : undefined} />
        </div>
      </section>
    }>
      <div className="file-list" onKeyDown={moveSelection}>
        {error && <div role="alert" className="banner"><p>{error}</p></div>}
        {commits.length === 0 && !error && <div className="empty">{isLoading ? "Loading history" : "No commits yet"}</div>}
        {dragged && canRewrite && destinations.length > 0 && (
          <div className="drop-strip" role="group" aria-label="Cherry-pick onto a branch">
            <span className="muted">Cherry-pick onto</span>
            {destinations.map((branch) => (
              <span key={branch} className={`drop-chip${dropId === `branch:${branch}` ? " is-over" : ""}`}
                onDragOver={(event) => { event.preventDefault(); setDropId(`branch:${branch}`); }} onDragLeave={() => setDropId(null)}
                onDrop={(event) => { event.preventDefault(); const source = dragged; setDragged(null); setDropId(null); if (source) setPicking({ commit: source, branch }); }}>
                {branch}
              </span>
            ))}
          </div>
        )}
        {commits.map((entry, index) => (
          <button className={`history-item${dropId === entry.id ? " is-drop-target" : ""}`} aria-pressed={entry.id === id} key={entry.id} data-commit={entry.id}
            draggable={canRewrite} onDragStart={(event) => { event.dataTransfer.setData("text/plain", entry.id); event.dataTransfer.effectAllowed = "move"; setDragged(entry); }}
            onDragEnd={() => { setDragged(null); setDropId(null); }}
            onDragOver={(event) => { if (dragged && dragged.id !== entry.id) { event.preventDefault(); setDropId(entry.id); } }}
            onDragLeave={() => setDropId((value) => value === entry.id ? null : value)} onDrop={(event) => { event.preventDefault(); dropOn(entry); }}
            onClick={() => select(entry.id)} onContextMenu={(event) => showCommitMenu(event, entry, index)}>
            <strong className="truncate">{entry.summary}</strong>
            <small><span className="truncate">{entry.author}</span><time dateTime={entry.date} title={commitDateTitle(entry.date)}>{commitAge(entry.date, now)}</time></small>
          </button>
        ))}
        {hasMore && <div className="history-more"><button className="button" disabled={isLoading} onClick={() => void loadMore()}>Load more commits</button></div>}
      </div>
      {menu.node}
      {squashing && (
        <ConfirmDialog title="Squash commits" confirmLabel="Squash" isDanger close={() => setSquashing(null)}
          confirm={() => void run({ type: "squash", commit: squashing.commit.id, onto: squashing.onto.id }, "Squash commits")}>
          <p>Fold <strong>{squashing.commit.summary}</strong> into <strong>{squashing.onto.summary}</strong>?</p>
          <p className="muted">The older commit keeps its message. This rewrites the commits after it, so their IDs change. Force-pushing may be needed if they were pushed.</p>
        </ConfirmDialog>
      )}
      {picking && (
        <ConfirmDialog title="Cherry-pick commit" confirmLabel="Cherry-pick" close={() => setPicking(null)}
          confirm={() => void run({ type: "cherryPick", commit: picking.commit.id, destination: picking.branch }, "Cherry-pick commit")}>
          <p>Apply <strong>{picking.commit.summary}</strong> to <strong>{picking.branch}</strong>?</p>
          <p className="muted">{isDirty ? "Cherry-pick needs a clean working tree, so this will be refused until you commit or stash your changes. " : ""}Git Workspace switches to {picking.branch} first and stays there.</p>
        </ConfirmDialog>
      )}
      {branching && <CreateBranchDialog commitLabel={`${branching.id.slice(0, SHORT_ID_LENGTH)} ${branching.summary}`} close={() => setBranching(null)}
        create={(name) => void run({ type: "createBranch", branch: name, start: branching.id }, "Create branch")} />}
    </WorkspaceSplit>
  );
}
