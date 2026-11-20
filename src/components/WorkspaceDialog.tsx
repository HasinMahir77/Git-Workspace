import { FolderOpen } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { git } from "../git/client";
import { messageOf } from "../git/workspace.helpers";
import type { Props } from "./workspace-dialog.types";

import { Modal } from "./Modal";

export function WorkspaceDialog({ kind, status, sync, isBusy, error, close, open, clone, run }: Props) {
  const [path, setPath] = useState("");
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
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
