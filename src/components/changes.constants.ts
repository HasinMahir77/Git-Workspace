export const FILE_STATES: Record<string, string> = {
  "?": "Untracked", A: "Added", M: "Modified", D: "Deleted", R: "Renamed", C: "Copied", T: "Type changed",
};

export type FileKind = "added" | "modified" | "deleted" | "renamed" | "conflicted";

export const FILE_KINDS: Record<string, FileKind> = { "?": "added", A: "added", D: "deleted", R: "renamed" };

