export type MenuItem =
  | { type?: "item"; label: string; shortcut?: string; action?: () => void; isEnabled?: boolean; submenu?: MenuItem[] }
  | { type: "separator" };

export type ContextMenuState = { x: number; y: number; items: MenuItem[] };
