import { useContext, useMemo } from "react";
import { DiffViewContext } from "../git/DiffViewContext";
import { splitDiff, unifiedDiff } from "../git/diff.helpers";
import { splitPath } from "../git/path.helpers";
import { languageOf } from "../git/syntax.language";
import { DiffBody } from "./DiffBody";
import { DiffOptions } from "./DiffOptions";
import { FileStatusIcon } from "./FileStatusIcon";
import type { Props } from "./diff-panel.types";

const RENAME_SEPARATOR = " → ";
const HIDDEN_META = /^(?:index |--- |\+\+\+ )/;

function Title({ title, isPath }: { title: string; isPath: boolean }) {
  if (!isPath || title.includes(RENAME_SEPARATOR)) return <span className="diff-title truncate" title={title}>{title}</span>;
  const { directory, name } = splitPath(title);
  return <span className="diff-title truncate" title={title}><span className="diff-directory">{directory}</span>{name}</span>;
}

function emptyMessage({ error, emptyTitle, title, isHistory, patch }: Pick<Props, "error" | "emptyTitle" | "title" | "isHistory" | "patch">): string {
  if (error) return "Diff unavailable";
  if (emptyTitle) return emptyTitle;
  if (!title) return isHistory ? "Select a commit" : "Select a changed file";
  return patch === null ? "Loading diff" : "No text changes";
}

export function DiffPanel({ title, detail, actions, emptyTitle, patch, error, isHistory = false, isStaged = false, fileStatus, hunkAction }: Props) {
  const { diffView } = useContext(DiffViewContext);
  const splitRows = useMemo(() => patch ? splitDiff(patch).filter((row) => (
    !("meta" in row) || !HIDDEN_META.test(row.meta) && (isHistory || !row.meta.startsWith("diff --git "))
  )) : [], [patch, isHistory]);
  const unifiedRows = useMemo(() => patch ? unifiedDiff(patch, isHistory) : [], [patch, isHistory]);
  const language = useMemo(() => isHistory ? null : languageOf(title), [isHistory, title]);
  const hasDiff = diffView === "unified" ? unifiedRows.length > 0 : splitRows.length > 0;
  return (
    <section className="diff-panel" aria-label={isHistory ? "Commit details" : "File diff"}>
      {title ? (
        <div className="diff-header">
          <Title title={title} isPath={!isHistory} />
          {detail ? <span className="diff-detail truncate">{detail}</span> : null}
          {actions}
          <DiffOptions />
          {fileStatus ? <FileStatusIcon kind={fileStatus.kind} label={fileStatus.label} /> : null}
        </div>
      ) : null}
      {hasDiff ? (
        <DiffBody diffView={diffView} unifiedRows={unifiedRows} splitRows={splitRows} hunkAction={hunkAction} isIncluded={isStaged} language={language} />
      ) : (
        <div className="diff-blankslate" role={error ? "alert" : undefined}>
          <p>{emptyMessage({ error, emptyTitle, title, isHistory, patch })}</p>
          {error ? <p className="muted">{error}</p> : null}
        </div>
      )}
    </section>
  );
}
