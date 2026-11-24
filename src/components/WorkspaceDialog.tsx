import { FolderOpen } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { git } from "../git/client";
import { messageOf } from "../git/workspace.helpers";
import type { Props } from "./workspace-dialog.types";

import { Modal } from "./Modal";

export function WorkspaceDialog({ kind, status, sync, isBusy, error, close, open, clone, init, run }: Props) {
  const [path, setPath] = useState("");
  const [source, setSource] = useState("");
  const [name, setName] = useState(kind === "addRemote" ? "origin" : "");
  const [remote, setRemote] = useState(sync?.fetchRemote ?? "");
  const [localError, setLocalError] = useState("");

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

  if (kind === "addRemote") {
    return (
      <Modal title="Add remote" close={close}>
        <form className="dialog-form" onSubmit={async (event) => {
          event.preventDefault();
          if (await run({ type: "addRemote", name: name.trim(), url: source.trim() }, "Add remote")) close();
        }}>
          {feedback}
          <label>Remote name
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="off" />
          </label>
          <label>Repository URL or local path
            <input className="field" value={source} onChange={(event) => setSource(event.target.value)} required autoComplete="off" />
          </label>
          <div className="dialog-actions">
            {cancel}
            <button className="button primary" disabled={!name.trim() || !source.trim() || isBusy}>Add remote</button>
          </div>
        </form>
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
  const isInit = kind === "init";
  const hasDestination = isClone || isInit;
  const label = isClone ? "Clone repository" : isInit ? "Create repository" : "Open repository";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    const parent = path.trim();
    const folder = name.trim();
    const isSuccessful = isClone ? await clone(parent, folder, source.trim()) :
      isInit ? await init(parent, folder) : await open(parent);
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
        <label>{hasDestination ? "Destination parent folder" : "Repository folder"}
          <span className="row">
            <input className="field" value={path} placeholder="/home/you/projects/repository" onChange={(event) => setPath(event.target.value)} required autoComplete="off" />
            <button type="button" className="button" onClick={() => void browse()}><FolderOpen size={15} /> Browse</button>
          </span>
        </label>
        {hasDestination && (
          <label>Folder name
            <input className="field" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="off" />
          </label>
        )}
        <div className="dialog-actions">
          {cancel}
          <button className="button primary" disabled={isBusy || !path.trim() || (hasDestination && !name.trim()) || (isClone && !source.trim())}>
            {isBusy ? (isClone ? "Cloning…" : isInit ? "Creating…" : "Opening…") : label}
          </button>
        </div>
      </form>
    </Modal>
  );
}
