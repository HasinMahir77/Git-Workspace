import type { DiffOptions } from "./bindings";
import type { DiffView } from "./diff-view.types";

export const DIFF_VIEW_KEY = "git-workspace.diff-view";
export const DIFF_OPTIONS_KEY = "git-workspace.diff-options";
export const DIFF_DISPLAY_OPTIONS: { value: DiffView; label: string }[] = [{ value: "unified", label: "Unified" }, { value: "split", label: "Split" }];
export const DEFAULT_DIFF_OPTIONS: DiffOptions = { shouldIgnoreWhitespace: false, contextLines: null };
export const WHOLE_FILE_CONTEXT = 99_999;
export const CONTEXT_CHOICES: { value: number | null; label: string }[] = [
  { value: null, label: "3 lines (default)" }, { value: 10, label: "10 lines" }, { value: 25, label: "25 lines" }, { value: WHOLE_FILE_CONTEXT, label: "Whole file" },
];
