import { useEffect, useRef, useState } from "react";
import { DIVIDER_WIDTH, FOLDED_WIDTH, RESIZE_STEP } from "./sidebar.constants";
import type { Sidebar, SidebarConfig } from "./sidebar.types";

export function useSidebar(config: SidebarConfig): Sidebar {
  const storage = `git-workspace.sidebar.${config.id}`;
  const panelId = `sidebar-${config.id}`;
  const [width, setWidth] = useState(() => {
    const saved = Number.parseInt(localStorage.getItem(`${storage}.width`) ?? "", 10);
    return Number.isFinite(saved) ? Math.min(config.max, Math.max(config.min, saved)) : config.width;
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem(`${storage}.collapsed`);
    return saved === null ? Boolean(config.isCollapsedByDefault) : saved === "true";
  });
  const drag = useRef<{ x: number; width: number; pointer: number } | null>(null);

  useEffect(() => {
    localStorage.setItem(`${storage}.width`, String(width));
    localStorage.setItem(`${storage}.collapsed`, String(isCollapsed));
  }, [storage, width, isCollapsed]);

  function maxWidth(handle: HTMLDivElement) {
    const available = handle.parentElement?.clientWidth ?? window.innerWidth;
    return Math.max(config.min, Math.min(config.max, Math.floor(available * config.ratio)));
  }

  function actualWidth(handle: HTMLDivElement) {
    return handle.previousElementSibling?.getBoundingClientRect().width ?? width;
  }

  function resize(next: number, handle: HTMLDivElement) {
    setWidth(Math.min(maxWidth(handle), Math.max(config.min, Math.round(next))));
  }

  const foldedWidth = config.foldedWidth ?? FOLDED_WIDTH;
  const dividerWidth = isCollapsed && foldedWidth === 0 ? 0 : DIVIDER_WIDTH;
  const track = isCollapsed ? `${foldedWidth}px` : `clamp(${config.min}px, ${width}px, ${config.ratio * 100}%)`;
  return {
    panelId,
    label: config.label,
    isCollapsed,
    toggle: () => setIsCollapsed((previous) => !previous),
    layout: { gridTemplateColumns: `${track} ${dividerWidth}px minmax(0, 1fr)` },
    divider: {
      role: "separator",
      tabIndex: 0,
      "aria-orientation": "vertical",
      "aria-label": `Resize ${config.label} sidebar`,
      "aria-controls": panelId,
      "aria-valuemin": config.min,
      "aria-valuemax": config.max,
      "aria-valuenow": width,
      onPointerDown(event) {
        if (event.button !== 0 || drag.current) return;
        drag.current = { x: event.clientX, width: actualWidth(event.currentTarget), pointer: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      },
      onPointerMove(event) {
        const start = drag.current;
        if (start?.pointer === event.pointerId) {
          resize(start.width + event.clientX - start.x, event.currentTarget);
        }
      },
      onLostPointerCapture() { drag.current = null; },
      onKeyDown(event) {
        const current = actualWidth(event.currentTarget);
        switch (event.key) {
          case "ArrowLeft": resize(current - RESIZE_STEP, event.currentTarget); break;
          case "ArrowRight": resize(current + RESIZE_STEP, event.currentTarget); break;
          case "Home": resize(config.min, event.currentTarget); break;
          case "End": resize(config.max, event.currentTarget); break;
          default: return;
        }
        event.preventDefault();
      },
    },
  };
}
