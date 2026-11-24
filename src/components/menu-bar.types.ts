import type { MenuItem } from "./context-menu.types";

export type MenuBarMenu = { label: string; items: MenuItem[] };
export type MenuBarProps = { menus: MenuBarMenu[]; isDisabled?: boolean };
