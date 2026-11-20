import { GitMerge, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { RECOVERY_COPY } from "../git/recovery.constants";
import { canContinueRecovery } from "../git/recovery.helpers";
import type { RecoveryBarProps } from "./recovery-bar.types";

export function RecoveryBar({ recovery, isBusy, run, openTerminal }: RecoveryBarProps) {
  const [isConfirmingAbort, setIsConfirmingAbort] = useState(false);
  const copy = RECOVERY_COPY[recovery.kind];
  const unmerged = recovery.unmerged;
  return (
    <section className="recovery-bar" aria-label={copy.title}>
      <div className="recovery-heading row">
        <GitMerge size={16} aria-hidden="true" />
        <strong>{copy.title}</strong>
        <span className="muted">{unmerged.length === 0 ? "All conflicts are resolved." : `${unmerged.length} unresolved ${unmerged.length === 1 ? "file" : "files"}`}</span>
        <span className="spacer" />
        <button className="button subtle" onClick={openTerminal}><SquareTerminal size={15} /> Open in Terminal</button>
        <button className="button primary" disabled={!canContinueRecovery(unmerged.length, isBusy)}
          onClick={() => void run({ type: "continueIntegration" }, copy.continueLabel)}>{copy.continueLabel}</button>
        {copy.hasSkip && <button className="button" disabled={isBusy} onClick={() => void run({ type: "skipIntegration" }, "Skip commit")}>Skip commit</button>}
        {isConfirmingAbort ? (
          <>
            <button className="button danger" disabled={isBusy} onClick={() => { setIsConfirmingAbort(false); void run({ type: "abortIntegration" }, copy.abortLabel); }}>{copy.discardLabel}</button>
            <button className="button" onClick={() => setIsConfirmingAbort(false)}>{copy.keepLabel}</button>
          </>
        ) : (
          <button className="button" disabled={isBusy} onClick={() => setIsConfirmingAbort(true)}>{copy.abortLabel}</button>
        )}
      </div>
      {copy.abortNote && <p className="muted recovery-note">{copy.abortNote}</p>}
      {unmerged.length > 0 && (
        <>
          <p className="muted recovery-note">Edit each file to remove the conflict markers, then mark it resolved. Marking a file resolved stages your edits.</p>
          <ul className="recovery-files">
            {unmerged.map((file) => (
              <li key={file.id} className="row">
                <code className="truncate" title={file.path}>{file.path}</code>
                <span className="spacer" />
                <button className="button" disabled={isBusy} onClick={() => void run({ type: "stage", id: file.id }, "Mark resolved")}>Mark resolved</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
