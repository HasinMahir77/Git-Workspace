import { FileDiff, GitCommitHorizontal } from "lucide-react";
import { useContext, useMemo } from "react";
import { DiffViewContext } from "../git/DiffViewContext";
import { splitDiff, unifiedDiff } from "../git/diff.helpers";
import { splitPath } from "../git/path.helpers";
import type { Props } from "./diff-panel.types";
import type { DiffLine } from "../git/diff.types";

const RENAME_SEPARATOR = " → ";

function HunkButton({ action, index, header }: { action: NonNullable<Props["hunkAction"]>; index: number; header: string }) {
  return <button type="button" className="button subtle hunk-button" disabled={action.isDisabled} onClick={() => action.run(index, header)}>{action.label}</button>;
}

function Cell({ line }: { line: DiffLine | null }) {
  return (
    <div className={`diff-cell ${line?.kind ?? ""}`}>
      <span className="line-number">{line?.number}</span>
      <code>{line?.text}</code>
    </div>
  );
}

function Title({ title, isPath }: { title: string; isPath: boolean }) {
  if (!isPath || title.includes(RENAME_SEPARATOR)) return <strong className="truncate" title={title}>{title}</strong>;
  const { directory, name } = splitPath(title);
  return <span className="diff-title truncate" title={title}><span className="diff-directory">{directory}</span><strong>{name}</strong></span>;
}

export function DiffPanel({ title, detail, actions, emptyTitle, patch, error, isHistory = false, isStaged = false, sides, hunkAction }: Props) {
  const diffView = useContext(DiffViewContext);
  const rows = useMemo(() => patch ? splitDiff(patch).filter((row) => (
    !("meta" in row) || !/^(?:index |--- |\+\+\+ )/.test(row.meta) && (isHistory || !row.meta.startsWith("diff --git "))
  )) : [], [patch, isHistory]);
  const unifiedRows = useMemo(() => patch ? unifiedDiff(patch, isHistory) : [], [patch, isHistory]);
  const Icon = isHistory ? GitCommitHorizontal : FileDiff;
  const hasDiff = diffView === "unified" ? unifiedRows.length > 0 : rows.length > 0;
  return (
    <section className="diff-panel" aria-label={isHistory ? "Commit details" : "File diff"}>
      {title && (
        <div className="diff-heading row">
          <Title title={title} isPath={!isHistory} />
          <span className="spacer" />
          {detail && <small className="truncate">{detail}</small>}
          {actions}
        </div>
      )}
      {hasDiff ? (
        <div className="diff-scroll" tabIndex={0}>
          {diffView === "split" && <div className="diff-sides">
            <span>{sides?.[0] ?? (isHistory ? "Before commit" : isStaged ? "HEAD" : "Index")}</span>
            <span>{sides?.[1] ?? (isHistory ? "After commit" : isStaged ? "Index" : "Working tree")}</span>
          </div>}
          {diffView === "unified" ? (
            <div className="unified-diff">{unifiedRows.map((row, index) => "oldNumber" in row ? (
              <div className={`unified-row ${row.kind}`} key={index}>
                <span className="line-number">{row.oldNumber}</span>
                <span className="line-number">{row.newNumber}</span>
                <code>{row.text}</code>
              </div>
            ) : row.kind === "hunk" ? (
              <div className="unified-row hunk" key={index}>
                <span className="line-number" /><span className="line-number" />
                <code>{row.text}{hunkAction && <HunkButton action={hunkAction} header={row.text} index={row.hunkIndex} />}</code>
              </div>
            ) : (
              <div className={`unified-row ${row.kind}`} key={index}>
                <span className="line-number" /><span className="line-number" />
                <code>{row.text}</code>
              </div>
            ))}</div>
          ) : rows.map((row, index) => "meta" in row ? (
            <div className="diff-meta" key={index}>{row.meta}
              {hunkAction && row.meta.startsWith("@@ ") && <HunkButton action={hunkAction} header={row.meta}
                index={rows.slice(0, index).filter((previous) => "meta" in previous && previous.meta.startsWith("@@ ")).length} />}</div>
          ) : (
            <div className="diff-line" key={index}><Cell line={row.left} /><Cell line={row.right} /></div>
          ))}
        </div>
      ) : (
        <div className="empty" role={error ? "alert" : undefined}>
          <Icon size={25} aria-hidden="true" />
          <h2>{error ? "Diff unavailable" : emptyTitle ? emptyTitle : !title ? (isHistory ? "Select a commit" : "Select a changed file") : patch === null ? "Loading diff" : "No text changes"}</h2>
          {error && <p className="muted">{error}</p>}
        </div>
      )}
    </section>
  );
}
