import type { MouseEvent } from "react";
import type { RepositoryInfo } from "../git/bindings";

export type RepositoryPickerProps = {
  entries: RepositoryInfo[];
  selected?: string;
  choose: (id: string) => void;
  open: () => void;
  clone: () => void;
  init: () => void;
  close: () => void;
  showMenu: (event: MouseEvent, entry: RepositoryInfo) => void;
  isBusy: boolean;
};
