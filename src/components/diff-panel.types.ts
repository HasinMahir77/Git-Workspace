import type { ReactNode } from "react";

export type Props = {
  title?: string;
  detail?: string;
  actions?: ReactNode;
  patch: string | null;
  error?: string;
  isHistory?: boolean;
  isStaged?: boolean;
  sides?: [string, string];
  hunkAction?: { label: string; isDisabled: boolean; run: (index: number, header: string) => void };
};
