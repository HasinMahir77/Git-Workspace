import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { git } from "../git/client";
import { fileKind, fileStateLabel, hasStagedChanges, hasUnstagedChanges, isFullyStaged, isPartlyStaged } from "../git/changes.helpers";
import { splitPath } from "../git/path.helpers";
import { copyText } from "../git/clipboard.helpers";
import { changesListMenu, changesMenu } from "../git/menu.helpers";
import { useExternalEditor } from "../git/useExternalEditor";
import { messageOf } from "../git/workspace.helpers";
import type { ChangedFile } from "../git/bindings";
import { ConfirmDialog } from "./ConfirmDialog";
import { useContextMenu } from "./useContextMenu";
import { StashPanel } from "./StashPanel";
import { DiffPanel } from "./DiffPanel";
import { FileStatusIcon } from "./FileStatusIcon";
import { IndeterminateCheckbox } from "./IndeterminateCheckbox";
import { WorkspaceSplit } from "./WorkspaceSplit";
import type { DiffSide, FileRowProps, Props } from "./changes.types";

function FileRow({ file, isSelected, select, toggle, showMenu, isBusy }: FileRowProps) {
  const { directory, name } = splitPath(file.path);
  const isStaged = isFullyStaged(file);
  const action = isStaged ? "Unstage" : "Stage";
  return (
    <div className={`file-row${isSelected ? " selected" : ""}`} onContextMenu={(event) => showMenu(event, file)}>
      <IndeterminateCheckbox checked={isStaged} isIndeterminate={isPartlyStaged(file)} disabled={isBusy || file.hasConflict}
        aria-label={`${action} ${file.path}`} title={`${action} ${file.path}`} onChange={() => toggle(file)} />
      <button className="file-select" aria-pressed={isSelected} title={file.path} onClick={(event) => select(file.id, event)}>
        <span className="file-path truncate"><span className="file-directory">{directory}</span>{name}</span>
      </button>
      <FileStatusIcon kind={fileKind(file)} label={fileStateLabel(file)} />
    </div>
  );
}

export function Changes({ sidebar, repo, repositoryPath, status, revision, isBusy, draft, changeDraft, run, report, tabs, viewHistory, openTerminal }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickedSide, setPickedSide] = useState<DiffSide | null>(null);
  const [discarding, setDiscarding] = useState<ChangedFile[] | null>(null);
  const anchor = useRef<string | null>(null);
  const menu = useContextMenu();
  const editorLabel = useExternalEditor();
  const [preview, setPreview] = useState<{ key: string; patch: string; error?: string } | null>(null);
  const files = status.files;
  const staged = files.filter(hasStagedChanges);
  const hasConflict = files.some((file) => file.hasConflict);
  const isAllStaged = files.length > 0 && files.every((file) => file.hasConflict || isFullyStaged(file));
  const isAnyStaged = files.some((file) => hasStagedChanges(file));

  function select(id: string, event: MouseEvent<HTMLButtonElement>) {
    const start = files.findIndex((file) => file.id === anchor.current);
    const end = files.findIndex((file) => file.id === id);
    if (event.shiftKey && start >= 0 && end >= 0) {
      setSelectedIds(files.slice(Math.min(start, end), Math.max(start, end) + 1).map((file) => file.id));
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedIds((previous) => previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id]);
      anchor.current = id;
    } else {
      setSelectedIds([id]);
      anchor.current = id;
    }
    setActiveId(id);
  }

  async function stageAll(shouldStage: boolean, targets: typeof files) {
    for (const target of targets) {
      if (target.hasConflict || (shouldStage ? isFullyStaged(target) : !hasStagedChanges(target))) continue;
      if (!await run({ type: shouldStage ? "stage" : "unstage", id: target.id }, shouldStage ? "Stage" : "Unstage")) break;
    }
  }

  function toggle(file: ChangedFile) {
    const targets = selectedIds.includes(file.id) ? files.filter((entry) => selectedIds.includes(entry.id)) : [file];
    void stageAll(!isFullyStaged(file), targets);
  }

  const attempt = (work: Promise<void>) => void work.catch((reason: unknown) => report(messageOf(reason)));

  async function discard(targets: ChangedFile[]) {
    for (const target of targets) {
      if (!await run({ type: "discard", id: target.id }, "Discard changes")) break;
    }
  }

  function showFileMenu(event: MouseEvent, file: ChangedFile) {
    if (isBusy) return;
    const isInSelection = selectedIds.includes(file.id);
    if (!isInSelection) {
      setSelectedIds([file.id]);
      setActiveId(file.id);
      anchor.current = file.id;
    }
    menu.open(event, changesMenu({
      repositoryPath, files: isInSelection ? files.filter((entry) => selectedIds.includes(entry.id)) : [file], editorLabel,
      copy: (text) => void copyText(text),
      discard: setDiscarding,
      ignorePath: (path) => void run({ type: "addToGitignore", pattern: path }, "Ignore"),
      ignorePattern: (pattern) => void run({ type: "addToGitignore", pattern }, "Ignore"),
      include: (targets, shouldInclude) => void stageAll(shouldInclude, targets),
      showInFiles: (path) => attempt(git.reveal(repo, path)),
      openInEditor: (path) => attempt(git.openInEditor(repo, path)),
      openDefault: (path) => attempt(git.openDefault(repo, path)),
    }));
  }

  function showListMenu(event: MouseEvent) {
    if (isBusy) return;
    menu.open(event, changesListMenu({
      hasChanges: files.length > 0,
      canStash: files.length > 0 && status.branch !== null && !hasConflict,
      discardAll: () => setDiscarding(files),
      stashAll: () => void run({ type: "stashPush", shouldIncludeUntracked: false }, "Stash changes"),
    }));
  }

  const file = files.find((entry) => entry.id === activeId) ?? files[0];
  const hasBothSides = file !== undefined && isPartlyStaged(file);
  const isStaged = file === undefined ? false : hasBothSides && pickedSide?.id === file.id ? pickedSide.isStaged : !hasUnstagedChanges(file);
  const id = file?.id;
  const key = `${id}:${isStaged}:${revision}`;

  useEffect(() => {
    if (!id) return;
    let isCurrent = true;
    void git.diff(repo, id, isStaged).then((patch) => {
      if (isCurrent) setPreview({ key, patch });
    }).catch((reason: unknown) => {
      if (isCurrent) setPreview({ key, patch: "", error: messageOf(reason) });
    });
    return () => { isCurrent = false; };
  }, [repo, id, isStaged, key]);

  const sideActions = file !== undefined && hasBothSides ? (
    <span className="segmented" role="group" aria-label="Diff version">
      {[false, true].map((isStagedSide) => (
        <button key={String(isStagedSide)} type="button" aria-pressed={isStaged === isStagedSide}
          onClick={() => setPickedSide({ id: file.id, isStaged: isStagedSide })}>{isStagedSide ? "Staged" : "Unstaged"}</button>
      ))}
    </span>
  ) : undefined;

  return (
    <WorkspaceSplit sidebar={sidebar} label="Changes and commit" tabs={tabs} preview={
      files.length === 0 ? (
        <section className="diff-panel clean-preview" aria-label="Working tree status">
          <div className="clean-card">
            <h2>No local changes</h2>
            <p className="muted">There are no uncommitted changes in this repository.</p>
            <div className="suggested-action">
              <div><strong>View the history of this branch</strong><p className="muted">See the commits on {status.branch ?? "this checkout"} and the files each one changed.</p></div>
              <button className="button" onClick={viewHistory}>View history</button>
            </div>
            <div className="suggested-action">
              <div><strong>Open the repository in Terminal</strong><p className="muted">Run Git commands that need a terminal prompt.</p></div>
              <button className="button" onClick={openTerminal}>Open in Terminal</button>
            </div>
          </div>
        </section>
      ) :
        <DiffPanel title={file ? (file.originalPath ? `${file.originalPath} → ${file.path}` : file.path) : undefined}
          isStaged={isStaged} actions={sideActions} fileStatus={file ? { kind: fileKind(file), label: fileStateLabel(file) } : undefined}
          hunkAction={file && !file.hasConflict && !file.originalPath && (isStaged ? file.staged : file.unstaged) !== "?" ? {
            verb: isStaged ? "Unstage" : "Stage", isDisabled: isBusy,
            toggleHunk: (index, header) => void run({ type: isStaged ? "unstageHunk" : "stageHunk", id: file.id, index, header }, isStaged ? "Unstage hunk" : "Stage hunk"),
            toggleLines: (index, header, lines) => void run({ type: isStaged ? "unstageLines" : "stageLines", id: file.id, index, header, lines },
              isStaged ? "Unstage lines" : "Stage lines"),
          } : undefined}
          patch={preview?.key === key ? preview.patch : null} error={preview?.key === key ? preview.error : undefined} />
    }>
      {files.length === 0 ? (
        <div className="file-list"><div className="empty"><Check size={22} /><h2>Working tree clean</h2></div></div>
      ) : (
        <>
          <div className="list-heading">
            <IndeterminateCheckbox checked={isAllStaged} isIndeterminate={isAnyStaged && !isAllStaged} disabled={isBusy || hasConflict && files.every((entry) => entry.hasConflict)}
              aria-label={isAllStaged ? "Unstage all files" : "Stage all files"} onChange={() => void stageAll(!isAllStaged, files)} />
            <strong>{files.length} changed {files.length === 1 ? "file" : "files"}</strong>
          </div>
          <div className="file-list" role="group" aria-label="Changed files" onContextMenu={showListMenu} onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a") {
              event.preventDefault();
              setSelectedIds(files.map((entry) => entry.id));
            }
          }}>
            {files.map((entry) => <FileRow key={entry.id} file={entry} isSelected={selectedIds.includes(entry.id) || (selectedIds.length === 0 && entry.id === file?.id)}
              select={select} toggle={toggle} showMenu={showFileMenu} isBusy={isBusy} />)}
          </div>
        </>
      )}
      <StashPanel repo={repo} revision={revision} isBusy={isBusy} hasChanges={files.length > 0} run={run} />
      <form className="commit-tray" onSubmit={(event) => {
        event.preventDefault();
        void run({ type: "commit", ...draft }, "Commit").then((isSuccessful) => {
          if (isSuccessful) changeDraft({ summary: "", body: "" });
        });
      }}>
        <label><span className="sr-only">Summary</span>
          <input className="field" name="commit-summary" placeholder="Summary (required)" autoComplete="off" value={draft.summary} disabled={isBusy}
            onChange={(event) => changeDraft({ ...draft, summary: event.target.value })} />
        </label>
        <label><span className="sr-only">Description (optional)</span>
          <textarea className="field" name="commit-body" placeholder="Description" rows={2} value={draft.body} disabled={isBusy}
            onChange={(event) => changeDraft({ ...draft, body: event.target.value })} />
        </label>
        {hasConflict && <small>Resolve conflicts in your editor or terminal.</small>}
        <button type="submit" className="button primary" disabled={isBusy || hasConflict || !draft.summary.trim() || staged.length === 0}>
          {status.branch ? <>Commit to <strong>{status.branch}</strong></> : "Commit"}
        </button>
      </form>
      {menu.node}
      {discarding && (
        <ConfirmDialog title="Confirm discard changes" confirmLabel={discarding.length === 1 ? "Discard changes" : `Discard ${discarding.length} files`}
          isDanger close={() => setDiscarding(null)} confirm={() => void discard(discarding)}>
          <p>Are you sure you want to discard all changes to:</p>
          <ul className="discard-list">{discarding.slice(0, 10).map((entry) => <li key={entry.id} className="truncate">{entry.path}</li>)}
            {discarding.length > 10 && <li className="muted">and {discarding.length - 10} more</li>}</ul>
          <p className="muted">Changes can be restored by retrieving them from the Trash.</p>
        </ConfirmDialog>
      )}
    </WorkspaceSplit>
  );
}
