import { Check, Download, FolderGit2, FolderOpen, Search } from "lucide-react";
import { useState } from "react";
import { Modal } from "./Modal";
import type { RepositoryPickerProps } from "./repository-picker.types";

export function RepositoryPicker({ entries, selected, choose, open, clone, close, isBusy }: RepositoryPickerProps) {
  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const matching = entries.filter((entry) => entry.path.toLowerCase().includes(search));

  return (
    <Modal title="Repositories" close={close} className="repository-picker">
      <div className="dialog-form">
        <form className="repository-search" onSubmit={(event) => {
          event.preventDefault();
          if (matching[0]) choose(matching[0].id);
        }}>
          <Search size={16} aria-hidden="true" />
          <input className="field" type="search" aria-label="Search repositories" placeholder="Search repositories"
            value={query} onChange={(event) => setQuery(event.target.value)} autoFocus />
        </form>
        <div className="repository-options">
          {matching.map((entry) => (
            <button className="repo row" aria-current={entry.id === selected ? "true" : undefined} key={entry.id}
              onClick={() => choose(entry.id)}>
              <FolderGit2 size={17} aria-hidden="true" />
              <span className="file-path truncate spacer"><strong className="truncate">{entry.name}</strong><small className="truncate">{entry.path}</small></span>
              {entry.id === selected && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
          {matching.length === 0 && <p className="muted">{search ? "No matching repositories" : "No repositories added yet"}</p>}
        </div>
        <div className="row repository-actions">
          <button className="button" disabled={isBusy} onClick={open}><FolderOpen size={16} aria-hidden="true" /> Open repository</button>
          <button className="button" disabled={isBusy} onClick={clone}><Download size={16} aria-hidden="true" /> Clone repository</button>
        </div>
      </div>
    </Modal>
  );
}
