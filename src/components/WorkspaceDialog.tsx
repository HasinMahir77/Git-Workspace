import { FolderOpen, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ToolVersion } from "../git/bindings";
import { git } from "../git/client";
import { messageOf } from "../git/workspace.helpers";
import type { Props } from "./workspace-dialog.types";

import { Modal } from "./Modal";

export function WorkspaceDialog({ kind, repo, status, sync, isBusy, error, close, open, clone, run }: Props) {
  const [path, setPath] = useState("");
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [remote, setRemote] = useState(sync?.fetchRemote ?? "");
  const [branches, setBranches] = useState<string[] | null>(null);
  const [tools, setTools] = useState<ToolVersion[] | null>(null);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    const onError = (reason: unknown) => { if (isCurrent) setLocalError(messageOf(reason)); };
    if (kind === "branches" && repo) {
      void git.branches(repo).then((result) => { if (isCurrent) setBranches(result); }).catch(onError);
    }
    if (kind === "environment") {
      void git.tools(repo).then((result) => { if (isCurrent) setTools(result); }).catch(onError);
    }
    return () => { isCurrent = false; };
  }, [kind, repo]);

  async function browse() {
    try {
      const result = await git.browse();
      if (typeof result === "string") setPath(result);
    } catch (reason: unknown) {
      setLocalError(messageOf(reason));
    }
  }

  const feedback = (localError || error) && <p role="alert" className="dialog-error">{localError || error}</p>;
  const cancel = <button type="button" className="button" onClick={close}>Cancel</button>;

  if (kind === "environment") {
    return (
      <Modal title="Git environment" close={close}>
        <div className="dialog-form">
          {feedback}
          {!tools && !localError && <p className="muted">Checking tools…</p>}
          {tools && <dl className="diagnostic">{tools.map((tool) => (
            <div className="diagnostic-row" key={tool.name}><dt><code>{tool.name}</code></dt><dd>{tool.version ?? "Unavailable on this PATH"}</dd></div>
          ))}</dl>}
          <p className="muted">Git and hooks inherit the app’s environment. If a tool is missing here, launch <code>git-workspace</code> from your working terminal.</p>
        </div>
      </Modal>
    );
  }

  if (kind === "branches") {
    const switchable = branches?.filter((branch) => branch !== status?.branch) ?? [];
    return (
      <Modal title="Branches" close={close}>
        <div className="dialog-form">
          {feedback}
          <p className="muted">{status?.branch ? `Current branch: ${status.branch}` : "Detached HEAD"}</p>
          {!branches && !localError && <p className="muted">Loading branches…</p>}
          {branches && switchable.length === 0 && <p className="muted">No other local branches.</p>}
          {switchable.length > 0 && (
            <div className="branch-options">{switchable.map((branch) => (
              <button className="button" key={branch} disabled={isBusy} onClick={() => {
                close();
                void run({ type: "switchBranch", branch }, "Switch branch");
              }}>{branch}</button>
            ))}</div>
          )}
          <form className="row" onSubmit={(event) => {
            event.preventDefault();
            close();
            void run({ type: "createBranch", branch: name.trim() }, "Create branch");
          }}>
            <input className="field" aria-label="New branch name" placeholder="New branch name" value={name}
              onChange={(event) => setName(event.target.value)} required />
            <button className="button primary" disabled={isBusy || !name.trim()}><Plus size={15} /> Create branch</button>
          </form>
        </div>
      </Modal>
    );
  }

  if (kind === "push") {
    const target = sync?.pushTarget;
    return (
      <Modal title="Push branch" close={close}>
        <form className="dialog-form" onSubmit={(event) => {
          event.preventDefault();
          if (!target) return;
          close();
          void run({ type: "push", target }, "Push");
        }}>
          <p>Push <strong>{status?.branch}</strong> to <strong>{target?.remote}/{target?.reference.replace(/^refs\/heads\//, "")}</strong>?</p>
          <div className="dialog-actions">{cancel}<button className="button primary" disabled={!target || isBusy}>Push branch</button></div>
        </form>
      </Modal>
    );
  }

  if (kind === "publish" || kind === "fetch") {
    const isPublish = kind === "publish";
    const title = isPublish ? "Publish branch" : "Fetch";
    return (
      <Modal title={title} close={close}>
        <form className="dialog-form" onSubmit={(event) => {
          event.preventDefault();
          if (!remote) return;
          close();
          void run({ type: isPublish ? "publish" : "fetch", remote }, title);
        }}>
          {isPublish && <p>Set an upstream for <strong>{status?.branch}</strong> and push to the selected remote.</p>}
          <label>Remote
            <select className="field" value={remote} onChange={(event) => setRemote(event.target.value)} required>
              <option value="" disabled>Select a remote</option>
              {sync?.remotes.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
          </label>
          <div className="dialog-actions">{cancel}<button className="button primary" disabled={!remote || isBusy}>{title}</button></div>
        </form>
      </Modal>
    );
  }

  const isClone = kind === "clone";
  const label = isClone ? "Clone repository" : "Open repository";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    const isSuccessful = isClone ? await clone(path.trim(), name.trim(), source.trim()) : await open(path.trim());
    if (isSuccessful) close();
  }

  return (
    <Modal title={label} close={close}>
      <form className="dialog-form" onSubmit={(event) => void submit(event)}>
        {feedback}
        {isClone && (
          <label>Repository URL or local path
            <input className="field" value={source} onChange={(event) => setSource(event.target.value)} required autoComplete="off" />
          </label>
        )}
        <label>{isClone ? "Destination parent folder" : "Repository folder"}
          <span className="row">
            <input className="field" value={path} placeholder="/home/you/projects/repository" onChange={(event) => setPath(event.target.value)} required autoComplete="off" />
            <button type="button" className="button" onClick={() => void browse()}><FolderOpen size={15} /> Browse</button>
          </span>
        </label>
        {isClone && (
          <label>Folder name
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="off" />
          </label>
        )}
        <div className="dialog-actions">
          {cancel}
          <button className="button primary" disabled={isBusy || !path.trim() || (isClone && (!source.trim() || !name.trim()))}>
            {isBusy ? (isClone ? "Cloning…" : "Opening…") : label}
          </button>
        </div>
      </form>
    </Modal>
  );
}
