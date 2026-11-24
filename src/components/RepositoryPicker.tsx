import { Check, Download, FolderGit2, FolderOpen, FolderPlus, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { RepositoryPickerProps } from "./repository-picker.types";

export function RepositoryPicker({ entries, selected, choose, open, clone, init, close, isBusy, showMenu }: RepositoryPickerProps) {
  const [query, setQuery] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const search = query.trim().toLowerCase();
  const matching = entries.filter((entry) => entry.path.toLowerCase().includes(search));

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !(target instanceof Element && target.closest(".repository-control"))) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  return (
    <div className="repository-picker" id="repository-picker" ref={panel} role="region" aria-label="Repositories">
      <form className="repository-search" onSubmit={(event) => {
        event.preventDefault();
        if (matching[0]) choose(matching[0].id);
      }}>
        <Search size={16} aria-hidden="true" />
        <input className="field" type="search" aria-label="Search repositories" placeholder="Filter repositories"
          value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
      </form>
      <div className="repository-options">
        <strong className="repository-list-heading">Repositories</strong>
        {matching.map((entry) => (
          <button className="repo row" aria-current={entry.id === selected ? "true" : undefined} key={entry.id}
            title={entry.path} onClick={() => choose(entry.id)} onContextMenu={(event) => showMenu(event, entry)}>
            <FolderGit2 size={17} aria-hidden="true" />
            <span className="file-path truncate spacer"><strong className="truncate">{entry.name}</strong><small className="truncate">{entry.path}</small></span>
            {entry.id === selected && <Check size={16} aria-hidden="true" />}
          </button>
        ))}
        {matching.length === 0 && <p className="muted">{search ? "No matching repositories" : "No repositories added yet"}</p>}
      </div>
      <div className="repository-actions">
        <button className="button" disabled={isBusy} onClick={open}><FolderOpen size={16} aria-hidden="true" /> Open repository</button>
        <button className="button" disabled={isBusy} onClick={clone}><Download size={16} aria-hidden="true" /> Clone repository</button>
        <button className="button" disabled={isBusy} onClick={init}><FolderPlus size={16} aria-hidden="true" /> New repository</button>
      </div>
    </div>
  );
}
