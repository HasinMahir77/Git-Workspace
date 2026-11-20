import { createContext } from "react";
import type { DiffView } from "./diff-view.types";

export const DiffViewContext = createContext<DiffView>("split");
