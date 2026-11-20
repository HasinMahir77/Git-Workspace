import { Check, GitCommitHorizontal, Minus, Plus, SquareTerminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { git } from "../git/client";
import { messageOf } from "../git/workspace.helpers";
import { DiffPanel } from "./DiffPanel";
import { CHANGES } from "./sidebar.constants";
import { WorkspaceSplit } from "./WorkspaceSplit";
import type { FileGroupProps, Props, Selection } from "./changes.types";
import { FILE_STATES } from "./changes.constants";

function FileGroup({ files, isStaged, selectedIds, select, selectAll, isBusy, run }: FileGroupProps) {
  const action = isStaged ? "Unstage" : "Stage";
  const Icon = isStaged ? Minus : Plus;
  return (
    <section aria-label={isStaged ? "Staged files" : "Unstaged files"}>
      <div className="group-heading">
        <button className="button icon subtle" disabled={isBusy || selectedIds.length === 0} title={`${action} selected files`}
          aria-label={`${action} selected files`} onClick={() => void (async () => {
            for (const id of selectedIds.filter((id) => files.some((file) => file.id === id && !file.hasConflict))) {
              if (!await run({ type: isStaged ? "unstage" : "stage", id }, action)) break;
            }
          })()}><Icon size={15} /></button>
        <strong>{isStaged ? "Staged" : "Unstaged"}</strong>
        <span className="count">{files.length}</span>
      </div>
      <div role="group" aria-label={isStaged ? "Staged file list" : "Unstaged file list"}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a") {
            event.preventDefault();
            selectAll();
          }
        }}>
      {files.map((file) => {
        const state = isStaged ? file.staged : file.unstaged;
        const isSelected = selectedIds.includes(file.id);
        const slash = file.path.lastIndexOf("/");
        const fileName = file.path.slice(slash + 1);
        const directory = slash < 0 ? null : file.path.slice(0, slash + 1);
        const stateLabel = file.hasConflict ? "Conflicted" : FILE_STATES[state] ?? state;
        return (
          <div className={`file-row ${isSelected ? "selected" : ""}`} key={file.id}>
            <button className="file-select row" aria-pressed={isSelected} title={file.path} onClick={(event) => select({ id: file.id, isStaged }, event)}>
              <span className={`file-status ${state === "D" ? "deleted" : state === "A" || state === "?" ? "added" : ""}`} title={stateLabel} aria-label={stateLabel}>
                {file.hasConflict ? "!" : state}
              </span>
              <span className="file-path truncate">
                <span className="truncate">{fileName}</span>
                {directory && <small className="truncate">{directory}</small>}
              </span>
            </button>
            <button type="button" className="button icon subtle" title={`${action} ${file.path}`} aria-label={`${action} ${file.path}`}
              disabled={isBusy || file.hasConflict} onClick={() => void run({ type: isStaged ? "unstage" : "stage", id: file.id }, action)}>
              <Icon size={15} />
            </button>
          </div>
        );
      })}
      </div>
    </section>
  );
}

export function Changes({ repo, status, revision, isBusy, draft, changeDraft, run, tabs, viewHistory, openTerminal }: Props) {
  const [selected, setSelected] = useState<Selection | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const anchor = useRef<Selection | null>(null);
  const [preview, setPreview] = useState<{ key: string; patch: string; error?: string } | null>(null);
  const staged = status.files.filter((file) => file.staged !== "." && !file.hasConflict);
  const unstaged = status.files.filter((file) => file.unstaged !== "." || file.hasConflict);
  const hasConflict = status.files.some((file) => file.hasConflict);
  function select(selection: Selection, event: MouseEvent<HTMLButtonElement>) {
    const files = selection.isStaged ? staged : unstaged;
    const inSameGroup = selected?.isStaged === selection.isStaged;
    const start = anchor.current?.isStaged === selection.isStaged ? files.findIndex((file) => file.id === anchor.current?.id) : -1;
    const end = files.findIndex((file) => file.id === selection.id);
    if (event.shiftKey && start >= 0 && end >= 0) {
      const range = files.slice(Math.min(start, end), Math.max(start, end) + 1).map((file) => file.id);
      setSelectedIds(range);
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedIds((previous) => {
        const group = inSameGroup ? previous : [];
        return group.includes(selection.id) ? group.filter((id) => id !== selection.id) : [...group, selection.id];
      });
      anchor.current = selection;
    } else {
      setSelectedIds([selection.id]);
      anchor.current = selection;
    }
    setSelected(selection);
  }
  function selectAll(isStaged: boolean) {
    const files = isStaged ? staged : unstaged;
    if (!files.length) return;
    setSelectedIds(files.map((file) => file.id));
    const first = files[0];
    if (first) { const selection = { id: first.id, isStaged }; setSelected(selection); anchor.current = selection; }
  }

  const selectedFile = (selected?.isStaged ? staged : unstaged).find((file) => file.id === selected?.id);
  const firstFile = unstaged[0] ?? staged[0];
  const file = selectedFile ?? firstFile;
  const isStaged = selectedFile ? Boolean(selected?.isStaged) : unstaged.length === 0;
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

  return (
    <WorkspaceSplit config={CHANGES} label="Changes and commit" tabs={tabs} preview={
      status.files.length === 0 ? (
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
          isStaged={isStaged}
          detail={file ? isStaged ? "Staged changes" : "Unstaged changes" : undefined}
          patch={preview?.key === key ? preview.patch : null} error={preview?.key === key ? preview.error : undefined} />
    }>
      <div className="file-list">
        {status.files.length === 0 ? (
          <div className="empty"><Check size={22} /><h2>Working tree clean</h2></div>
        ) : (
          <>
            <FileGroup files={unstaged} isStaged={false} selectedIds={selected?.isStaged === false ? selectedIds : []} select={select} selectAll={() => selectAll(false)} isBusy={isBusy} run={run} />
            <FileGroup files={staged} isStaged selectedIds={selected?.isStaged === true ? selectedIds : []} select={select} selectAll={() => selectAll(true)} isBusy={isBusy} run={run} />
          </>
        )}
      </div>
      <form className="commit-tray" onSubmit={(event) => {
        event.preventDefault();
        void run({ type: "commit", ...draft }, "Commit").then((isSuccessful) => {
          if (isSuccessful) changeDraft({ summary: "", body: "" });
        });
      }}>
        <div className="row">
          <GitCommitHorizontal size={16} aria-hidden="true" />
          <strong>Commit changes</strong>
          <span className="spacer" />
          <small>{staged.length} staged</small>
        </div>
        <label><span className="sr-only">Summary</span>
          <input className="field" name="commit-summary" placeholder="Summary" autoComplete="off" value={draft.summary} disabled={isBusy}
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
