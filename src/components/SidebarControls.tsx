import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Sidebar } from "./sidebar.types";

export function SidebarToggle({ sidebar }: { sidebar: Sidebar }) {
  const label = `${sidebar.isCollapsed ? "Expand" : "Collapse"} ${sidebar.label} sidebar`;
  const Icon = sidebar.isCollapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button type="button" className="button icon subtle sidebar-toggle" aria-label={label} title={label}
      aria-expanded={!sidebar.isCollapsed} aria-controls={sidebar.panelId} onClick={sidebar.toggle}>
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}

export function SidebarDivider({ sidebar }: { sidebar: Sidebar }) {
  if (sidebar.isCollapsed) return <div className="sidebar-gap" aria-hidden="true" />;
  return <div className="sidebar-divider" {...sidebar.divider} />;
}
