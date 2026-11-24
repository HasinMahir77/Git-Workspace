import { createContext } from "react";
import type { DiffViewSetting } from "./diff-view.types";

export const DiffViewContext = createContext<DiffViewSetting>({ diffView: "unified", changeDiffView: () => undefined });
