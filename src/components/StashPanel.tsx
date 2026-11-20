import { Archive } from "lucide-react";
import { useEffect, useState } from "react";
import { git } from "../git/client";
import type { StashEntry } from "../git/bindings";
import { messageOf } from "../git/workspace.helpers";
import type { StashPanelProps } from "./stash-panel.types";

export function StashPanel({ repo, revision, isBusy, hasChanges, run }: StashPanelProps) {
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [error, setError] = useState("");
  const [isStashing, setIsStashing] = useState(false);
  const [shouldIncludeUntracked, setShouldIncludeUntracked] = useState(false);
  const [droppingId, setDroppingId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void git.stashes(repo).then((entries) => { if (isCurrent) { setStashes(entries); setError(""); } })
      .catch((reason: unknown) => { if (isCurrent) setError(messageOf(reason)); });
    return () => { isCurrent = false; };
  }, [repo, revision]);

  if (!hasChanges && stashes.length === 0 && !error) return null;
  return (
    <section className="stash-panel" aria-label="Stashes">
      <div className="group-heading">
        <Archive size={15} aria-hidden="true" />
        <strong>Stashes</strong>
        <span className="count">{stashes.length}</span>
        <span className="spacer" />
        {hasChanges && !isStashing && <button className="button" disabled={isBusy} onClick={() => setIsStashing(true)}>Stash changes…</button>}
      </div>
      {error && <p role="alert" className="dialog-error">{error}</p>}
      {isStashing && (
        <form className="stash-form" onSubmit={(event) => {
          event.preventDefault();
          setIsStashing(false);
          void run({ type: "stashPush", shouldIncludeUntracked }, "Stash changes");
        }}>
          <label className="row"><input type="checkbox" checked={shouldIncludeUntracked}
            onChange={(event) => setShouldIncludeUntracked(event.target.checked)} /> Include untracked files</label>
          <div className="row">
            <button className="button primary" disabled={isBusy}>Stash</button>
            <button type="button" className="button subtle" onClick={() => setIsStashing(false)}>Cancel</button>
          </div>
        </form>
      )}
      <ul className="stash-list">
        {stashes.map((stash) => (
          <li key={stash.id} className="stash-item">
            <span className="truncate" title={stash.message}>{stash.message}</span>
            <span className="row">
              <button className="button" disabled={isBusy} title="Restore with staging and keep the stash"
                onClick={() => void run({ type: "stashApply", id: stash.id }, "Restore stash")}>Restore</button>
              {droppingId === stash.id ? (
                <>
                  <button className="button danger" disabled={isBusy}
                    onClick={() => { setDroppingId(null); void run({ type: "stashDrop", id: stash.id }, "Drop stash"); }}>Drop stash</button>
                  <button className="button subtle" onClick={() => setDroppingId(null)}>Keep</button>
                </>
              ) : <button className="button" disabled={isBusy} onClick={() => setDroppingId(stash.id)}>Drop</button>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
