import { ChevronRight } from "lucide-react";
import { useLayoutEffect, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ContextMenuState, MenuItem } from "./context-menu.types";

const VIEWPORT_MARGIN = 4;

function isActionable(item: MenuItem): item is Exclude<MenuItem, { type: "separator" }> {
  return item.type !== "separator" && item.isEnabled !== false;
}

function MenuList({ items, close, isSubmenu = false }: { items: MenuItem[]; close: () => void; isSubmenu?: boolean }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const list = useRef<HTMLDivElement>(null);

  function move(step: number) {
    const buttons = [...list.current?.querySelectorAll<HTMLButtonElement>(":scope > button:not(:disabled)") ?? []];
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(current + step + buttons.length) % buttons.length]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") move(1);
    else if (event.key === "ArrowUp") move(-1);
    else if (event.key === "ArrowRight" && document.activeElement instanceof HTMLElement && document.activeElement.ariaHasPopup) {
      document.activeElement.click();
    } else if (event.key === "ArrowLeft" && isSubmenu) {
      setOpenIndex(null);
      (list.current?.parentElement?.querySelector(":scope > button[aria-expanded]") as HTMLElement | null)?.focus();
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div className={isSubmenu ? "context-menu context-submenu" : "context-menu"} role="menu" ref={list} onKeyDown={onKeyDown}>
      {items.map((item, index) => item.type === "separator" ? (
        <div className="context-separator" role="separator" key={index} />
      ) : (
        <div className="context-entry" key={index} onPointerEnter={() => setOpenIndex(item.submenu && isActionable(item) ? index : null)}>
          <button type="button" role="menuitem" disabled={!isActionable(item)} aria-haspopup={item.submenu ? "menu" : undefined}
            aria-expanded={item.submenu ? openIndex === index : undefined}
            onClick={() => {
              if (item.submenu) { setOpenIndex(index); return; }
              close();
              item.action?.();
            }}>
            <span className="truncate">{item.label}</span>
            {item.submenu && <ChevronRight size={13} aria-hidden="true" />}
          </button>
          {item.submenu && openIndex === index && <MenuList items={item.submenu} close={close} isSubmenu />}
        </div>
      ))}
    </div>
  );
}

export function ContextMenu({ menu, close }: { menu: ContextMenuState; close: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: menu.x, top: menu.y });

  useLayoutEffect(() => {
    const box = container.current?.getBoundingClientRect();
    if (!box) return;
    setPosition({
      left: Math.max(VIEWPORT_MARGIN, Math.min(menu.x, window.innerWidth - box.width - VIEWPORT_MARGIN)),
      top: Math.max(VIEWPORT_MARGIN, Math.min(menu.y, window.innerHeight - box.height - VIEWPORT_MARGIN)),
    });
    container.current?.querySelector<HTMLElement>("[role=menu]")?.focus();
  }, [menu]);

  useEffect(() => {
    const dismiss = (event: Event) => {
      if (!container.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    };
    document.addEventListener("pointerdown", dismiss, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [close]);

  return (
    <div className="context-menu-layer" ref={container} style={position}>
      <MenuList items={menu.items} close={close} />
    </div>
  );
}
