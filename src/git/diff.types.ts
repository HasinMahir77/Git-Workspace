export type DiffLine = {
  number: number;
  text: string;
  kind: "context" | "addition" | "deletion";
  hunkLine: number;
};

export type DiffRow = { meta: string } | { left: DiffLine | null; right: DiffLine | null };

export type UnifiedRow =
  | { kind: "file" | "meta" | "note"; text: string }
  | { kind: "hunk"; text: string; hunkIndex: number }
  | { kind: DiffLine["kind"]; text: string; oldNumber: number | null; newNumber: number | null; hunkLine: number };
