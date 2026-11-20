import type { ChangedFile } from "./bindings";
import { FILE_KINDS, FILE_STATES } from "../components/changes.constants";
import type { FileKind } from "../components/changes.constants";

const CLEAN = ".";

export const hasStagedChanges = (file: ChangedFile) => file.staged !== CLEAN && !file.hasConflict;
export const hasUnstagedChanges = (file: ChangedFile) => file.unstaged !== CLEAN || file.hasConflict;
export const isFullyStaged = (file: ChangedFile) => hasStagedChanges(file) && !hasUnstagedChanges(file);
export const isPartlyStaged = (file: ChangedFile) => hasStagedChanges(file) && hasUnstagedChanges(file);

export function fileState(file: ChangedFile): string {
  return file.unstaged !== CLEAN ? file.unstaged : file.staged;
}

export function fileKind(file: ChangedFile): FileKind {
  return file.hasConflict ? "conflicted" : FILE_KINDS[fileState(file)] ?? "modified";
}

export function fileStateLabel(file: ChangedFile): string {
  return file.hasConflict ? "Conflicted" : FILE_STATES[fileState(file)] ?? fileState(file);
}
