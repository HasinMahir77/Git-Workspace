import { Check, GitCommitHorizontal, Minus, Plus, SquareTerminal } from "lucide-react";
import { useEffect, useState } from "react";
import { git } from "../git/client";
import { messageOf } from "../git/workspace.helpers";
import { DiffPanel } from "./DiffPanel";
import { CHANGES } from "./sidebar.constants";
import { WorkspaceSplit } from "./WorkspaceSplit";
import type { FileGroupProps, Props, Selection } from "./changes.types";
import { FILE_STATES } from "./changes.constants";

function FileGroup({ files, isStaged, selected, select, isBusy, run }: FileGroupProps) {
  const action = isStaged ? "Unstage" : "Stage";
  const Icon = isStaged ? Minus : Plus;
  return (
    <section aria-label={isStaged ? "Staged files" : "Unstaged files"}>
      <div className="group-heading">
        <strong>{isStaged ? "Staged" : "Unstaged"}</strong>
        <span className="count">{files.length}</span>
      </div>
      {files.map((file) => {
        const state = isStaged ? file.staged : file.unstaged;
        const isSelected = selected?.id === file.id && selected.isStaged === isStaged;
        const slash = file.path.lastIndexOf("/");
        const fileName = file.path.slice(slash + 1);
        const directory = slash < 0 ? null : file.path.slice(0, slash + 1);
        const stateLabel = file.hasConflict ? "Conflicted" : FILE_STATES[state] ?? state;
        return (
          <div className={`file-row ${isSelected ? "selected" : ""}`} key={file.id}>
            <button className="file-select row" aria-pressed={isSelected} title={file.path} onClick={() => select({ id: file.id, isStaged })}>
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
    </section>
  );
}

export function Changes({ repo, status, revision, isBusy, draft, changeDraft, run, tabs, viewHistory, openTerminal }: Props) {
  const [selected, select] = useState<Selection | null>(null);
  const [preview, setPreview] = useState<{ key: string; patch: string; error?: string } | null>(null);
  const staged = status.files.filter((file) => file.staged !== "." && !file.hasConflict);
  const unstaged = status.files.filter((file) => file.unstaged !== "." || file.hasConflict);
  const hasConflict = status.files.some((file) => file.hasConflict);
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
            <FileGroup files={unstaged} isStaged={false} selected={id ? { id, isStaged } : null} select={select} isBusy={isBusy} run={run} />
            <FileGroup files={staged} isStaged selected={id ? { id, isStaged } : null} select={select} isBusy={isBusy} run={run} />
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
        <label>Summary
          <input className="field" name="commit-summary" autoComplete="off" value={draft.summary} disabled={isBusy}
            onChange={(event) => changeDraft({ ...draft, summary: event.target.value })} />
        </label>
        <label>Description <span className="sr-only">(optional)</span>
          <textarea className="field" name="commit-body" rows={2} value={draft.body} disabled={isBusy}
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
