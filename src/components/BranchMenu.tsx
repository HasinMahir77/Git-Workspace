import { Check, GitBranch, Plus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { git } from "../git/client";
import { messageOf } from "../git/workspace.helpers";
import type { BranchMenuProps } from "./branch-menu.types";

export function BranchMenu({ repo, current, isBusy, close, run }: BranchMenuProps) {
  const [branches, setBranches] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isCurrent = true;
    void git.branches(repo).then((result) => { if (isCurrent) setBranches(result); })
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

  const matching = branches?.filter((branch) => branch.toLowerCase().includes(query.trim().toLowerCase()));
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
        {matching?.length === 0 && <p className="muted">No matching local branches</p>}
        {matching?.map((branch) => (
          <button className="branch-item" key={branch} disabled={isBusy} aria-current={branch === current ? "true" : undefined}
            onClick={() => { if (branch !== current) void run({ type: "switchBranch", branch }, "Switch branch"); close(); }}>
            {branch === current ? <Check size={15} aria-hidden="true" /> : <GitBranch size={15} aria-hidden="true" />}
            <span className="truncate">{branch}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
