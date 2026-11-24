import { useEffect, useState } from "react";
import { git } from "../git/client";
import type { ConflictSides } from "../git/bindings";
import { messageOf } from "../git/workspace.helpers";
import type { ConflictDialogProps } from "./conflict-dialog.types";
import { Modal } from "./Modal";

export function ConflictDialog({ repo, fileId, path, run, close }: ConflictDialogProps) {
  const [sides, setSides] = useState<ConflictSides | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    void git.conflictSides(repo, fileId).then((loaded) => {
      if (!isCurrent) return;
      setSides(loaded);
      setResult(loaded.working);
    }).catch((reason: unknown) => { if (isCurrent) setError(messageOf(reason)); });
    return () => { isCurrent = false; };
  }, [repo, fileId]);

  const ours = sides?.ours ?? "";
  const theirs = sides?.theirs ?? "";
  const pick = (text: string) => ({ onClick: () => setResult(text), type: "button" as const, className: "button" });
  return (
    <Modal title={`Resolve conflict: ${path}`} close={close} className="conflict-dialog">
      <div className="dialog-form">
        {error && <p role="alert" className="dialog-error">{error}</p>}
        {!sides && !error && <p className="muted">Reading the file…</p>}
        {sides && (
          <>
            <div className="conflict-columns">
              <section aria-label="Ours">
                <h3>Ours <small>(current branch)</small></h3>
                <pre tabIndex={0}>{sides.ours ?? "This side deleted the file."}</pre>
                <button {...pick(ours)} disabled={sides.ours === null}>Use ours</button>
              </section>
              <section aria-label="Theirs">
                <h3>Theirs <small>(incoming)</small></h3>
                <pre tabIndex={0}>{sides.theirs ?? "This side deleted the file."}</pre>
                <button {...pick(theirs)} disabled={sides.theirs === null}>Use theirs</button>
              </section>
            </div>
            <label>
              <span className="row">
                <strong>Result</strong>
                <span className="spacer" />
                <button {...pick(`${ours}${theirs}`)}>Use both</button>
                <button {...pick(sides.working)}>Reset to conflict markers</button>
              </span>
              <textarea className="field conflict-result" spellCheck={false} value={result} onChange={(event) => setResult(event.target.value)} />
            </label>
            {/^(<{7}|>{7}) /m.test(result) && <p className="muted">The result still has conflict markers. Remove them before saving.</p>}
          </>
        )}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={close}>Cancel</button>
          <button type="button" className="button primary" disabled={!sides}
            onClick={() => { close(); void run({ type: "resolveConflict", id: fileId, content: result }, "Resolve conflict"); }}>Save and mark resolved</button>
        </div>
      </div>
    </Modal>
  );
}
