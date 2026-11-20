import { Check, GitCommitHorizontal, SquareTerminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { git } from "../git/client";
import { fileKind, fileStateLabel, hasStagedChanges, hasUnstagedChanges, isFullyStaged, isPartlyStaged } from "../git/changes.helpers";
import { splitPath } from "../git/path.helpers";
import { messageOf } from "../git/workspace.helpers";
import { StashPanel } from "./StashPanel";
import { DiffPanel } from "./DiffPanel";
import { FileStatusIcon } from "./FileStatusIcon";
import { IndeterminateCheckbox } from "./IndeterminateCheckbox";
import { WorkspaceSplit } from "./WorkspaceSplit";
import type { DiffSide, FileRowProps, Props } from "./changes.types";

function FileRow({ file, isSelected, select, toggle, isBusy }: FileRowProps) {
  const { directory, name } = splitPath(file.path);
  const isStaged = isFullyStaged(file);
  const action = isStaged ? "Unstage" : "Stage";
  return (
    <div className={`file-row${isSelected ? " selected" : ""}`}>
      <IndeterminateCheckbox checked={isStaged} isIndeterminate={isPartlyStaged(file)} disabled={isBusy || file.hasConflict}
        aria-label={`${action} ${file.path}`} title={`${action} ${file.path}`} onChange={() => toggle(file)} />
      <button className="file-select" aria-pressed={isSelected} title={file.path} onClick={(event) => select(file.id, event)}>
        <span className="file-path truncate"><span className="file-directory">{directory}</span>{name}</span>
      </button>
      <FileStatusIcon kind={fileKind(file)} label={fileStateLabel(file)} />
    </div>
  );
}

export function Changes({ sidebar, repo, status, revision, isBusy, draft, changeDraft, run, tabs, viewHistory, openTerminal }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickedSide, setPickedSide] = useState<DiffSide | null>(null);
  const anchor = useRef<string | null>(null);
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

  function toggle(file: (typeof files)[number]) {
    const targets = selectedIds.includes(file.id) ? files.filter((entry) => selectedIds.includes(entry.id)) : [file];
    void stageAll(!isFullyStaged(file), targets);
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
            <div className="clean-mark"><Check size={22} aria-hidden="true" /></div>
            <h2>No local changes</h2>
            <p className="muted">Your working tree is clean.</p>
            <div className="row">
              <button className="button" onClick={viewHistory}><GitCommitHorizontal size={16} /> View history</button>
              <button className="button" onClick={openTerminal}><SquareTerminal size={16} /> Open in Terminal</button>
            </div>
          </div>
        </section>
      ) :
        <DiffPanel title={file ? (file.originalPath ? `${file.originalPath} → ${file.path}` : file.path) : undefined}
          isStaged={isStaged} actions={sideActions}
          hunkAction={file && !file.hasConflict && !file.originalPath && (isStaged ? file.staged : file.unstaged) !== "?" ? {
            label: isStaged ? "Unstage hunk" : "Stage hunk", isDisabled: isBusy,
            run: (index, header) => void run({ type: isStaged ? "unstageHunk" : "stageHunk", id: file.id, index, header }, isStaged ? "Unstage hunk" : "Stage hunk"),
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
          <div className="file-list" role="group" aria-label="Changed files" onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a") {
              event.preventDefault();
              setSelectedIds(files.map((entry) => entry.id));
            }
          }}>
            {files.map((entry) => <FileRow key={entry.id} file={entry} isSelected={selectedIds.includes(entry.id) || (selectedIds.length === 0 && entry.id === file?.id)}
              select={select} toggle={toggle} isBusy={isBusy} />)}
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
          Commit{status.branch ? ` to ${status.branch}` : ""}
        </button>
      </form>
    </WorkspaceSplit>
  );
}
