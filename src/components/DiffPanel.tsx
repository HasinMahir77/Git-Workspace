import { FileDiff, GitCommitHorizontal } from "lucide-react";
import { useContext, useMemo } from "react";
import { DiffViewContext } from "../git/DiffViewContext";
import { splitDiff } from "../git/diff.helpers";
import type { Props } from "./diff-panel.types";
import type { DiffLine } from "../git/diff.types";

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

export function DiffPanel({ title, detail, patch, error, isHistory = false, isStaged = false, sides, hunkAction }: Props) {
  const diffView = useContext(DiffViewContext);
  const rows = useMemo(() => patch ? splitDiff(patch).filter((row) => (
    !("meta" in row) || !/^(?:index |--- |\+\+\+ )/.test(row.meta) && (isHistory || !row.meta.startsWith("diff --git "))
  )) : [], [patch, isHistory]);
  const Icon = isHistory ? GitCommitHorizontal : FileDiff;
  return (
    <section className="diff-panel" aria-label={isHistory ? "Commit details" : "File diff"}>
      {title && (
        <div className="diff-heading row">
          <Icon size={16} aria-hidden="true" />
          <strong className="truncate" title={title}>{title}</strong>
          <span className="spacer" />
          {detail && <small>{detail}</small>}
        </div>
      )}
      {rows.length > 0 ? (
        <div className="diff-scroll" tabIndex={0}>
          {diffView === "split" && <div className="diff-sides">
            <span>{sides?.[0] ?? (isHistory ? "Before commit" : isStaged ? "HEAD" : "Index")}</span>
            <span>{sides?.[1] ?? (isHistory ? "After commit" : isStaged ? "Index" : "Working tree")}</span>
          </div>}
          {diffView === "unified" ? (
            <pre className="unified-diff">{patch?.split("\n").map((line, index, lines) => line.startsWith("@@ ") && hunkAction ? (
              <span className="hunk-line" key={index}>{line}{" "}<HunkButton action={hunkAction} header={line}
                index={lines.slice(0, index).filter((previous) => previous.startsWith("@@ ")).length} />{"\n"}</span>
            ) : (
              <span className={line.startsWith("+") && !line.startsWith("+++") ? "addition" : line.startsWith("-") && !line.startsWith("---") ? "deletion" : ""} key={index}>{line}{"\n"}</span>
            ))}</pre>
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
          <h2>{error ? "Diff unavailable" : !title ? (isHistory ? "Select a commit" : "Select a changed file") : patch === null ? "Loading diff" : "No text changes"}</h2>
          {error && <p className="muted">{error}</p>}
        </div>
      )}
    </section>
  );
}
