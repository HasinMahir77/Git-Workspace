import type { ReactNode } from "react";
import { Modal } from "./Modal";

export function ConfirmDialog({ title, confirmLabel, isDanger = false, confirm, close, children }: {
  title: string; confirmLabel: string; isDanger?: boolean; confirm: () => void; close: () => void; children: ReactNode;
}) {
  return (
    <Modal title={title} close={close}>
      <div className="dialog-form">
        {children}
        <div className="dialog-actions">
          <button type="button" className="button" onClick={close}>Cancel</button>
          <button type="button" className={`button ${isDanger ? "danger-fill" : "primary"}`} autoFocus
            onClick={() => { close(); confirm(); }}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
}
