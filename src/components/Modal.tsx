import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }}>
      <div className="dialog-title row">
        <h2 id={titleId}>{title}</h2>
        <span className="spacer" />
        <button className="button icon subtle" aria-label="Close dialog" onClick={close}><X size={17} /></button>
      </div>
      {children}
    </dialog>
  );
}
