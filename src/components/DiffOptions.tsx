import { GearIcon, TriangleDownIcon } from "@primer/octicons-react";
import { useContext, useEffect, useRef, useState } from "react";
import { DiffViewContext } from "../git/DiffViewContext";
import { DIFF_DISPLAY_OPTIONS } from "../git/diff-view.constants";

export function DiffOptions() {
  const { diffView, changeDiffView } = useContext(DiffViewContext);
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
        </div>
      ) : null}
    </div>
  );
}
