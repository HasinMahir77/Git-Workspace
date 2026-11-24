import { AlertIcon, DiffAddedIcon, DiffModifiedIcon, DiffRemovedIcon, DiffRenamedIcon } from "@primer/octicons-react";
import type { FileKind } from "./changes.constants";

const ICONS = {
  added: DiffAddedIcon, modified: DiffModifiedIcon, deleted: DiffRemovedIcon, renamed: DiffRenamedIcon, conflicted: AlertIcon,
};

export function FileStatusIcon({ kind, label }: { kind: FileKind; label: string }) {
  const Icon = ICONS[kind];
  return <span className={`file-status ${kind}`} title={label} role="img" aria-label={label}><Icon aria-hidden="true" /></span>;
}
