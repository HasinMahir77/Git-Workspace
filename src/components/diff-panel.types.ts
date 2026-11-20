export type Props = {
  title?: string;
  detail?: string;
  patch: string | null;
  error?: string;
  isHistory?: boolean;
  isStaged?: boolean;
  sides?: [string, string];
  hunkAction?: { label: string; isDisabled: boolean; run: (index: number, header: string) => void };
};
