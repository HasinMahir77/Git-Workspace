import { createContext } from "react";
import { DEFAULT_DIFF_OPTIONS } from "./diff-view.constants";
import type { DiffViewSetting } from "./diff-view.types";

export const DiffViewContext = createContext<DiffViewSetting>({
  diffView: "unified", changeDiffView: () => undefined, options: DEFAULT_DIFF_OPTIONS, changeOptions: () => undefined,
});
