import { useEffect, useState } from "react";
import { git } from "../git/client";
import type { BlameLine } from "../git/bindings";
import { commitAge, commitDateTitle } from "../git/date.helpers";
import { messageOf } from "../git/workspace.helpers";
import type { BlameDialogProps } from "./blame-dialog.types";
import { Modal } from "./Modal";

const SHORT_ID_LENGTH = 8;
const SECOND_MS = 1000;

export function BlameDialog({ repo, path, close }: BlameDialogProps) {
  const [lines, setLines] = useState<BlameLine[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    void git.blame(repo, path).then((result) => { if (isCurrent) setLines(result); })
      .catch((reason: unknown) => { if (isCurrent) setError(messageOf(reason)); });
    return () => { isCurrent = false; };
  }, [repo, path]);

  const now = Date.now();
  return (
    <Modal title={`Blame: ${path}`} close={close} className="blame-dialog">
      <div className="dialog-form">
        <p className="muted">Who last changed each line, as of the latest commit. Uncommitted edits are not included.</p>
        {error && <p role="alert" className="dialog-error">{error}</p>}
        {!lines && !error && <p className="muted">Reading blame…</p>}
        {lines && (
          <div className="blame-scroll" tabIndex={0}>
            {lines.map((entry, index) => {
              const isFirstOfGroup = index === 0 || lines[index - 1]?.commit !== entry.commit;
              const date = new Date(entry.authoredAt * SECOND_MS).toISOString();
              return (
                <div className={`blame-row${isFirstOfGroup ? " is-first" : ""}`} key={entry.line}>
                  <span className="blame-info" title={isFirstOfGroup ? `${entry.summary}\n${entry.author}, ${commitDateTitle(date)}` : undefined}>
                    {isFirstOfGroup ? <><code>{entry.commit.slice(0, SHORT_ID_LENGTH)}</code><span className="truncate">{entry.author}</span><time dateTime={date}>{commitAge(date, now)}</time></> : null}
                  </span>
                  <span className="blame-number">{entry.line}</span>
                  <code className="blame-text">{entry.text}</code>
                </div>
              );
            })}
          </div>
        )}
        <div className="dialog-actions"><button type="button" className="button" onClick={close}>Close</button></div>
      </div>
    </Modal>
  );
}
