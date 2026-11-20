import { useCallback, useState } from "react";
import type { MouseEvent } from "react";
import { ContextMenu } from "./ContextMenu";
import type { ContextMenuState, MenuItem } from "./context-menu.types";

export function useContextMenu() {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const close = useCallback(() => setMenu(null), []);
  const open = useCallback((event: MouseEvent, items: MenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, items });
  }, []);
  return { open, node: menu ? <ContextMenu menu={menu} close={close} /> : null };
}
