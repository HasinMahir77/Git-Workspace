import { GearIcon, TriangleDownIcon } from "@primer/octicons-react";
import { useContext, useEffect, useRef, useState } from "react";
import { DiffViewContext } from "../git/DiffViewContext";
import { CONTEXT_CHOICES, DIFF_DISPLAY_OPTIONS } from "../git/diff-view.constants";
import { isDefaultDiffOptions } from "../git/diff-view.helpers";

export function DiffOptions() {
  const { diffView, changeDiffView, options, changeOptions } = useContext(DiffViewContext);
  const [isOpen, setIsOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setIsOpen(false); };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keydown);
    };
  }, [isOpen]);

  return (
    <div className="diff-options" ref={root}>
      <button type="button" ref={trigger} className="diff-options-trigger" aria-label="Diff settings" title="Diff settings"
        aria-expanded={isOpen} onClick={() => setIsOpen((value) => !value)}>
        <GearIcon /><TriangleDownIcon />
      </button>
      {isOpen ? (
        <div className="popover diff-options-popover" role="dialog" aria-label="Diff settings">
          <fieldset>
            <legend>Diff display</legend>
            {DIFF_DISPLAY_OPTIONS.map(({ value, label }) => (
              <label key={value}>
                <input type="radio" name="diff-display" value={value} checked={diffView === value} onChange={() => changeDiffView(value)} /> {label}
              </label>
            ))}
          </fieldset>
          <label className="diff-option-check">
            <input type="checkbox" checked={options.shouldIgnoreWhitespace}
              onChange={(event) => changeOptions({ ...options, shouldIgnoreWhitespace: event.target.checked })} /> Hide whitespace changes
          </label>
          <fieldset>
            <legend>Unchanged lines around a change</legend>
            {CONTEXT_CHOICES.map(({ value, label }) => (
              <label key={label}>
                <input type="radio" name="diff-context" checked={options.contextLines === value} onChange={() => changeOptions({ ...options, contextLines: value })} /> {label}
              </label>
            ))}
          </fieldset>
          {isDefaultDiffOptions(options) ? null : <p className="muted diff-option-note">Staging is off while these settings change the diff.</p>}
        </div>
      ) : null}
    </div>
  );
}
