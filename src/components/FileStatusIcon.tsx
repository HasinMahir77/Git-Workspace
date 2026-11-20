import { SquareArrowRight, SquareMinus, SquarePen, SquarePlus, TriangleAlert } from "lucide-react";
import type { FileKind } from "./changes.constants";

const ICONS = {
  added: SquarePlus, modified: SquarePen, deleted: SquareMinus, renamed: SquareArrowRight, conflicted: TriangleAlert,
};

export function FileStatusIcon({ kind, label }: { kind: FileKind; label: string }) {
  const Icon = ICONS[kind];
  return <span className={`file-status ${kind}`} title={label} role="img" aria-label={label}><Icon size={14} aria-hidden="true" /></span>;
}
