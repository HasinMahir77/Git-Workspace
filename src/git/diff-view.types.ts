export type DiffView = "split" | "unified";
export type DiffViewSetting = { diffView: DiffView; changeDiffView: (view: DiffView) => void };
