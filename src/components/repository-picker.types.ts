import type { RepositoryInfo } from "../git/bindings";

export type RepositoryPickerProps = {
  entries: RepositoryInfo[];
  selected?: string;
  choose: (id: string) => void;
  open: () => void;
  clone: () => void;
  close: () => void;
  isBusy: boolean;
};
