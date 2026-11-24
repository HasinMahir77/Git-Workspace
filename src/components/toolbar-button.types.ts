import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

export type ToolbarButtonLayout = "standard" | "subtitle";

export type ToolbarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>;
  icon: ReactNode;
  text: string;
  description?: string;
  layout?: ToolbarButtonLayout;
  isDropdown?: boolean;
  badge?: ReactNode;
};
