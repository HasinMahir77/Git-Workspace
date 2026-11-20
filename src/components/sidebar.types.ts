import type { CSSProperties, HTMLAttributes } from "react";

export type SidebarConfig = {
  id: string;
  isCollapsedByDefault?: boolean;
  foldedWidth?: number;
  label: string;
  width: number;
  min: number;
  max: number;
  ratio: number;
};

export type Sidebar = {
  panelId: string;
  label: string;
  isCollapsed: boolean;
  toggle: () => void;
  layout: CSSProperties;
  divider: HTMLAttributes<HTMLDivElement>;
};
