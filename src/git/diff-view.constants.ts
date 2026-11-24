import type { DiffView } from "./diff-view.types";

export const DIFF_VIEW_KEY = "git-workspace.diff-view";
export const DIFF_DISPLAY_OPTIONS: { value: DiffView; label: string }[] = [{ value: "unified", label: "Unified" }, { value: "split", label: "Split" }];
