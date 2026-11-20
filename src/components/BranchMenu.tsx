import { Check, GitBranch, GitCompare, Plus, Search } from "lucide-react";
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
        <span className="branch-search"><Search size={16} aria-hidden="true" />
          <input className="field" type="search" aria-label="Filter branches" placeholder="Filter branches"
            autoFocus value={query} onChange={(event) => setQuery(event.target.value)} />
        </span>
        <button className="button" disabled={isBusy} onClick={() => setIsCreating((value) => !value)}>
          <Plus size={15} /> New branch
        </button>
        <button className="button" disabled={isBusy} onClick={() => { close(); compare(); }}>
          <GitCompare size={15} /> Compare branches…
        </button>
      </div>
      {isCreating && (
        <form className="branch-create row" onSubmit={(event) => {
          event.preventDefault();
          close();
          void run({ type: "createBranch", branch: name.trim() }, "Create branch");
        }}>
          <input className="field" aria-label="New branch name" placeholder="New branch name" autoFocus
            value={name} onChange={(event) => setName(event.target.value)} required />
          <button className="button primary" disabled={isBusy || !name.trim()}>Create branch</button>
        </form>
      )}
      <div className="branch-list">
        {!branches && !error && <p className="muted">Loading branches…</p>}
        {local?.length === 0 && remote?.length === 0 && <p className="muted">No matching branches</p>}
        {local && local.length > 0 && <h3 className="branch-group">Local</h3>}
        {local?.map((branch) => (
          <button className="branch-item" key={branch} disabled={isBusy} aria-current={branch === current ? "true" : undefined}
            onClick={() => { if (branch !== current) void run({ type: "switchBranch", branch }, "Switch branch"); close(); }}>
            {branch === current ? <Check size={15} aria-hidden="true" /> : <GitBranch size={15} aria-hidden="true" />}
            <span className="truncate">{branch}</span>
          </button>
        ))}
        {remote && remote.length > 0 && <h3 className="branch-group">Remote</h3>}
        {remote?.map((branch) => (
          <button className="branch-item" key={branch} disabled={isBusy}
            title={`Creates local branch ${localNameFor(branch)} tracking ${branch}`}
            onClick={() => { void run({ type: "checkoutRemote", remoteBranch: branch }, "Check out remote branch"); close(); }}>
            <GitBranch size={15} aria-hidden="true" />
            <span className="truncate">{branch}</span>
            <small className="muted truncate">{branches?.local.includes(localNameFor(branch)) ? "use local" : `new ${localNameFor(branch)}`}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
