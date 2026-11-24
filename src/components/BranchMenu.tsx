import { CheckIcon, GitBranchIcon, GitCompareIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "@primer/octicons-react";
import { useEffect, useRef, useState } from "react";
import { git } from "../git/client";
import { messageOf } from "../git/workspace.helpers";
import type { BranchGroups } from "../git/bindings";
import { localNameFor } from "../git/recovery.helpers";
import type { BranchMenuProps } from "./branch-menu.types";

export function BranchMenu({ repo, current, isBusy, close, run, compare }: BranchMenuProps) {
  const [branches, setBranches] = useState<BranchGroups | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [change, setChange] = useState<{ kind: "rename" | "delete"; branch: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [shouldForce, setShouldForce] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCurrent = true;
    void git.branchGroups(repo).then((result) => { if (isCurrent) setBranches(result); })
      .catch((reason: unknown) => { if (isCurrent) setError(messageOf(reason)); });
    return () => { isCurrent = false; };
  }, [repo]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!menu.current?.parentElement?.contains(event.target as Node)) close();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keydown);
    };
  }, [close]);

  const isMatch = (branch: string) => branch.toLowerCase().includes(query.trim().toLowerCase());
  const local = branches?.local.filter(isMatch);
  const remote = branches?.remote.filter(isMatch);
  return (
    <div className="branch-menu" ref={menu} id="branch-menu" role="region" aria-label="Branch selection">
      <div className="branch-menu-heading"><strong>Branches</strong></div>
      {error && <p role="alert" className="dialog-error">{error}</p>}
      <div className="branch-menu-search">
        <span className="branch-search"><SearchIcon aria-hidden="true" />
          <input className="field" type="search" aria-label="Filter branches" placeholder="Filter branches"
            autoFocus value={query} onChange={(event) => setQuery(event.target.value)} />
        </span>
        <button className="button" disabled={isBusy} onClick={() => setIsCreating((value) => !value)}>
          <PlusIcon /> New branch
        </button>
        <button className="button" disabled={isBusy} onClick={() => { close(); compare(); }}>
          <GitCompareIcon /> Compare branches…
        </button>
      </div>
      {isCreating && (
        <form className="branch-create row" onSubmit={(event) => {
          event.preventDefault();
          close();
          void run({ type: "createBranch", branch: name.trim(), start: null }, "Create branch");
        }}>
          <input className="field" aria-label="New branch name" placeholder="New branch name" autoFocus
            value={name} onChange={(event) => setName(event.target.value)} required />
          <button className="button primary" disabled={isBusy || !name.trim()}>Create branch</button>
        </form>
      )}
      {change?.kind === "rename" && (
        <form className="branch-create row" onSubmit={(event) => {
          event.preventDefault();
          close();
          void run({ type: "renameBranch", from: change.branch, to: editName.trim() }, "Rename branch");
        }}>
          <input className="field" aria-label={`New name for ${change.branch}`} autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} required />
          <button className="button primary" disabled={isBusy || !editName.trim() || editName.trim() === change.branch}>Rename branch</button>
          <button type="button" className="button" onClick={() => setChange(null)}>Cancel</button>
        </form>
      )}
      {change?.kind === "delete" && (
        <form className="branch-delete" onSubmit={(event) => {
          event.preventDefault();
          close();
          void run({ type: "deleteBranch", branch: change.branch, shouldForce }, "Delete branch");
        }}>
          <p>Delete <strong>{change.branch}</strong>? Only the local branch goes. Its commits stay on any remote.</p>
          <label className="row"><input type="checkbox" checked={shouldForce} onChange={(event) => setShouldForce(event.target.checked)} /> Delete even if it has commits that are not merged</label>
          <div className="row">
            <button className="button danger-fill" disabled={isBusy} autoFocus>Delete branch</button>
            <button type="button" className="button" onClick={() => setChange(null)}>Cancel</button>
          </div>
        </form>
      )}
      <div className="branch-list">
        {!branches && !error && <p className="muted">Loading branches…</p>}
        {local?.length === 0 && remote?.length === 0 && <p className="muted">No matching branches</p>}
        {local && local.length > 0 && <h3 className="branch-group">Local</h3>}
        {local?.map((branch) => (
          <div className="branch-row" key={branch}>
            <button className="branch-item" disabled={isBusy} aria-current={branch === current ? "true" : undefined}
              onClick={() => { if (branch !== current) void run({ type: "switchBranch", branch }, "Switch branch"); close(); }}>
              {branch === current ? <CheckIcon aria-hidden="true" /> : <GitBranchIcon aria-hidden="true" />}
              <span className="truncate">{branch}</span>
            </button>
            <button type="button" className="branch-row-action" aria-label={`Rename ${branch}`} title="Rename branch" disabled={isBusy}
              onClick={() => { setChange({ kind: "rename", branch }); setEditName(branch); }}><PencilIcon /></button>
            {branch !== current && (
              <button type="button" className="branch-row-action" aria-label={`Delete ${branch}`} title="Delete branch" disabled={isBusy}
                onClick={() => { setChange({ kind: "delete", branch }); setShouldForce(false); }}><TrashIcon /></button>
            )}
          </div>
        ))}
        {remote && remote.length > 0 && <h3 className="branch-group">Remote</h3>}
        {remote?.map((branch) => (
          <button className="branch-item" key={branch} disabled={isBusy}
            title={`Creates local branch ${localNameFor(branch)} tracking ${branch}`}
            onClick={() => { void run({ type: "checkoutRemote", remoteBranch: branch }, "Check out remote branch"); close(); }}>
            <GitBranchIcon aria-hidden="true" />
            <span className="truncate">{branch}</span>
            <small className="muted truncate">{branches?.local.includes(localNameFor(branch)) ? "use local" : `new ${localNameFor(branch)}`}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
