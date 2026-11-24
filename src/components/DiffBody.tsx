import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { changedLinesBetween, lineNumberWidth } from "../git/diff.helpers";
import type { DiffLine, DiffRow, UnifiedRow } from "../git/diff.types";
import { FILE_HEADER_PREFIX, HUNK_HEADER_PREFIX, KEYBOARD_CLICK_DETAIL, LINE_PREFIXES, NBSP } from "./diff-body.constants";
import type { DiffBodyProps, HunkControls, LineRange } from "./diff-body.types";

type LinePrefix = (typeof LINE_PREFIXES)[keyof typeof LINE_PREFIXES];
type ChangeLine = { hunk: number; line: number };

const WHOLE_HUNK = { from: 0, to: Number.POSITIVE_INFINITY };

function Content({ prefix, text }: { prefix: LinePrefix; text: string }) {
  return (
    <div className="diff-content">
      <span className="diff-prefix" aria-hidden="true">{`${NBSP}${NBSP}${prefix}${NBSP}${NBSP}`}</span>
      <span className="diff-text">{text}</span>
    </div>
  );
}

function Gutter({ numbers, change, controls }: { numbers: (number | null | undefined)[]; change?: ChangeLine; controls?: HunkControls }) {
  const content = numbers.map((number, index) => <span key={index}>{number ?? ""}</span>);
  if (!controls || !change) return <div className="diff-gutter">{content}</div>;
  const { hunk, line } = change;
  const label = `${controls.verb} line ${numbers.find((number) => number != null) ?? ""}`.trim();
  return (
    <button type="button" aria-label={label} title={label} disabled={controls.isDisabled}
      className={`diff-gutter selectable${controls.isIncluded ? " is-included" : ""}${controls.isHot(hunk, line) ? " is-hot" : ""}`}
      onMouseDown={(event: MouseEvent) => { if (event.button === 0) { event.preventDefault(); controls.startDrag(hunk, line); } }}
      onMouseEnter={() => { if (!controls.extendDrag(hunk, line)) controls.hover({ hunk, from: line, to: line }); }}
      onMouseLeave={() => controls.hover(null)}
      onClick={(event) => { if (event.detail === KEYBOARD_CLICK_DETAIL) controls.toggleLines(hunk, [line]); }}>
      {content}
    </button>
  );
}

function HunkHandle({ changes, controls }: { changes: ChangeLine[]; controls?: HunkControls }) {
  if (!controls) return null;
  const hunk = changes[0]?.hunk;
  if (hunk === undefined) return <span className="hunk-handle-spacer" aria-hidden="true" />;
  const isHot = changes.some(({ line }) => controls.isHot(hunk, line));
  return (
    <span className={`hunk-handle${controls.isIncluded ? " is-included" : ""}${isHot ? " is-hot" : ""}`} aria-hidden="true"
      onClick={() => { if (!controls.isDisabled) controls.toggleHunk(hunk); }}
      onMouseEnter={() => controls.hover({ hunk, ...WHOLE_HUNK })} onMouseLeave={() => controls.hover(null)} />
  );
}

function HunkHeader({ text, hunk, controls }: { text: string; hunk: number; controls?: HunkControls }) {
  const label = controls ? `${controls.verb} hunk` : "";
  return (
    <div className="diff-row hunk-info">
      {controls ? <span className="hunk-handle-spacer" aria-hidden="true" /> : null}
      {controls ? (
        <button type="button" className="diff-gutter hunk-toggle" aria-label={label} title={label} disabled={controls.isDisabled}
          onClick={() => controls.toggleHunk(hunk)} onMouseEnter={() => controls.hover({ hunk, ...WHOLE_HUNK })} onMouseLeave={() => controls.hover(null)} />
      ) : <div className="diff-gutter" />}
      <Content prefix={NBSP} text={text} />
    </div>
  );
}

function InfoRow({ kind, text, controls }: { kind: "meta" | "note" | "file"; text: string; controls?: HunkControls }) {
  if (kind === "file") return <div className="diff-row file"><span className="truncate">{text.replace(FILE_HEADER_PREFIX, "")}</span></div>;
  return (
    <div className={`diff-row ${kind}`}>
      {controls ? <span className="hunk-handle-spacer" aria-hidden="true" /> : null}
      <div className="diff-gutter" />
      <Content prefix={NBSP} text={text} />
    </div>
  );
}

function UnifiedRows({ rows, controls }: { rows: UnifiedRow[]; controls?: HunkControls }) {
  let hunk = -1;
  return rows.map((row, index): ReactNode => {
    if (row.kind === "hunk") {
      hunk = row.hunkIndex;
      return <HunkHeader key={index} text={row.text} hunk={hunk} controls={controls} />;
    }
    if (!("oldNumber" in row)) return <InfoRow key={index} kind={row.kind} text={row.text} controls={controls} />;
    const change = row.kind === "context" ? undefined : { hunk, line: row.hunkLine };
    return (
      <div key={index} className={`diff-row ${row.kind}`}>
        <HunkHandle changes={change ? [change] : []} controls={controls} />
        <Gutter numbers={[row.oldNumber, row.newNumber]} change={change} controls={controls} />
        <Content prefix={LINE_PREFIXES[row.kind]} text={row.text} />
      </div>
    );
  });
}

function Side({ line, side, hunk, controls }: { line: DiffLine | null; side: "before" | "after"; hunk: number; controls?: HunkControls }) {
  if (!line) return <div className={`diff-side ${side} is-empty`}><div className="diff-gutter" /><div className="diff-content" /></div>;
  const change = line.kind === "context" ? undefined : { hunk, line: line.hunkLine };
  return (
    <div className={`diff-side ${side} ${line.kind}`}>
      <Gutter numbers={[line.number]} change={change} controls={controls} />
      <Content prefix={LINE_PREFIXES[line.kind]} text={line.text} />
    </div>
  );
}

function SplitRows({ rows, controls }: { rows: DiffRow[]; controls?: HunkControls }) {
  let hunk = -1;
  return rows.map((row, index): ReactNode => {
    if ("meta" in row) {
      if (row.meta.startsWith(HUNK_HEADER_PREFIX)) {
        hunk += 1;
        return <HunkHeader key={index} text={row.meta} hunk={hunk} controls={controls} />;
      }
      return <InfoRow key={index} kind={row.meta.startsWith(FILE_HEADER_PREFIX) ? "file" : "meta"} text={row.meta} controls={controls} />;
    }
    const changes = [row.left, row.right].flatMap((line) => line && line.kind !== "context" ? [{ hunk, line: line.hunkLine }] : []);
    return (
      <div key={index} className={`diff-row ${changes.length > 0 ? "changed" : "context"}`}>
        <Side line={row.left} side="before" hunk={hunk} controls={controls} />
        <HunkHandle changes={changes} controls={controls} />
        <Side line={row.right} side="after" hunk={hunk} controls={controls} />
      </div>
    );
  });
}

function hunkHeaders(rows: UnifiedRow[]): string[] {
  return rows.flatMap((row) => row.kind === "hunk" ? [row.text] : []);
}

function largestLineNumber(rows: UnifiedRow[]): number {
  return rows.reduce((largest, row) => "oldNumber" in row ? Math.max(largest, row.oldNumber ?? 0, row.newNumber ?? 0) : largest, 0);
}

export function DiffBody({ diffView, unifiedRows, splitRows, hunkAction, isIncluded }: DiffBodyProps) {
  const [highlight, setHighlight] = useState<LineRange | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<LineRange | null>(null);
  const headers = useMemo(() => hunkHeaders(unifiedRows), [unifiedRows]);
  const width = useMemo(() => lineNumberWidth(largestLineNumber(unifiedRows)), [unifiedRows]);

  function toggleLines(hunk: number, lines: number[]) {
    const header = headers[hunk];
    if (hunkAction && header !== undefined && lines.length > 0) hunkAction.toggleLines(hunk, header, lines);
  }

  useEffect(() => {
    if (!isDragging) return;
    const finish = () => {
      const range = drag.current;
      drag.current = null;
      setIsDragging(false);
      setHighlight(null);
      if (range) toggleLines(range.hunk, changedLinesBetween(unifiedRows, range.hunk, range.from, range.to));
    };
    document.addEventListener("mouseup", finish, { once: true });
    return () => document.removeEventListener("mouseup", finish);
  });

  const controls: HunkControls | undefined = hunkAction ? {
    verb: hunkAction.verb, isDisabled: hunkAction.isDisabled, isIncluded,
    isHot: (hunk, line) => highlight !== null && highlight.hunk === hunk && line !== undefined
      && line >= Math.min(highlight.from, highlight.to) && line <= Math.max(highlight.from, highlight.to),
    hover: (range) => { if (!drag.current) setHighlight(range); },
    startDrag: (hunk, line) => {
      drag.current = { hunk, from: line, to: line };
      setHighlight(drag.current);
      setIsDragging(true);
    },
    extendDrag: (hunk, line) => {
      if (!drag.current) return false;
      if (drag.current.hunk === hunk) {
        drag.current = { ...drag.current, to: line };
        setHighlight(drag.current);
      }
      return true;
    },
    toggleHunk: (hunk) => {
      const header = headers[hunk];
      if (header !== undefined) hunkAction.toggleHunk(hunk, header);
    },
    toggleLines,
  } : undefined;
  const style = { "--line-number-width": `${width}px` } as CSSProperties;

  return (
    <div className={`diff-scroll ${diffView}-diff${controls ? " editable" : ""}${isDragging ? " is-dragging" : ""}`} style={style} tabIndex={0}>
      {diffView === "unified" ? <UnifiedRows rows={unifiedRows} controls={controls} /> : <SplitRows rows={splitRows} controls={controls} />}
    </div>
  );
}
