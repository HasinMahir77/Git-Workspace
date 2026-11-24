import type { DiffOptions } from "./bindings";

export type DiffView = "split" | "unified";
export type DiffViewSetting = {
  diffView: DiffView;
  changeDiffView: (view: DiffView) => void;
  options: DiffOptions;
  changeOptions: (options: DiffOptions) => void;
};
