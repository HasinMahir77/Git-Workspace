import type { ReactNode } from "react";
import { SidebarDivider, SidebarToggle } from "./SidebarControls";
import type { Sidebar } from "./sidebar.types";

export function WorkspaceSplit({ sidebar, label, children, preview, tabs }: {
  sidebar: Sidebar;
  label: string;
  children: ReactNode;
  preview: ReactNode;
  tabs: ReactNode;
}) {
  return (
    <div className="work-area" style={sidebar.layout}>
      <aside className={`file-panel${sidebar.isCollapsed ? " is-collapsed" : ""}`} aria-label={label}>
        <div className="sidebar-heading row">
          {tabs}
          <SidebarToggle sidebar={sidebar} />
        </div>
        <div className="file-panel-content" id={sidebar.panelId} hidden={sidebar.isCollapsed}>{children}</div>
      </aside>
      <SidebarDivider sidebar={sidebar} />
      {preview}
    </div>
  );
}
