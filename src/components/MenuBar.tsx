import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import { ContextMenu } from "./ContextMenu";
import type { ContextMenuState } from "./context-menu.types";
import type { MenuBarProps } from "./menu-bar.types";

export function MenuBar({ menus, isDisabled = false }: MenuBarProps) {
  const [open, setOpen] = useState<{ index: number; menu: ContextMenuState } | null>(null);
  const wasOpenOnPress = useRef(false);

  function show(index: number, target: HTMLElement) {
    const box = target.getBoundingClientRect();
    const menu = menus[index];
    if (menu) setOpen({ index, menu: { x: box.left, y: box.bottom, items: menu.items } });
  }

  return (
    <nav className="menu-bar" aria-label="Application menu">
      {menus.map(({ label }, index) => (
        <button key={label} type="button" className="menu-bar-item" disabled={isDisabled} aria-haspopup="menu" aria-expanded={open?.index === index}
          onPointerDown={() => { wasOpenOnPress.current = open?.index === index; }}
          onClick={(event: MouseEvent<HTMLButtonElement>) => { if (wasOpenOnPress.current) wasOpenOnPress.current = false; else show(index, event.currentTarget); }}
          onPointerEnter={(event) => { if (open && open.index !== index) show(index, event.currentTarget); }}>{label}</button>
      ))}
      {open ? <ContextMenu key={open.index} menu={open.menu} close={() => setOpen(null)} /> : null}
    </nav>
  );
}
