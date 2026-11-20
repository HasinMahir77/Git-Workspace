import { useState } from "react";
import { Modal } from "./Modal";

export function CreateBranchDialog({ commitLabel, create, close }: { commitLabel: string; create: (name: string) => void; close: () => void }) {
  const [name, setName] = useState("");
  return (
    <Modal title="Create a branch" close={close}>
      <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); close(); create(name.trim()); }}>
        <label>Name
          <input className="field" aria-label="New branch name" value={name} autoFocus required
            onChange={(event) => setName(event.target.value)} />
        </label>
        <p className="muted">The new branch starts at {commitLabel} and is checked out.</p>
        <div className="dialog-actions">
          <button type="button" className="button" onClick={close}>Cancel</button>
          <button className="button primary" disabled={!name.trim()}>Create branch</button>
        </div>
      </form>
    </Modal>
  );
}
