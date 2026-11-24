import { TriangleDownIcon } from "@primer/octicons-react";
import type { ToolbarButtonProps } from "./toolbar-button.types";

export function ToolbarButton({ icon, text, description, layout = "standard", isDropdown = false, badge, className, ...props }: ToolbarButtonProps) {
  return (
    <button type="button" className={`toolbar-button${className ? ` ${className}` : ""}`} {...props}>
      <span className="toolbar-icon">{icon}</span>
      <span className={`toolbar-text ${layout}`}>
        <span className="toolbar-title">{text}</span>
        {description ? <span className="toolbar-description">{description}</span> : null}
      </span>
      {badge}
      {isDropdown ? <TriangleDownIcon className="toolbar-arrow" /> : null}
    </button>
  );
}
