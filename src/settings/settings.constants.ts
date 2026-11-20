import { Monitor, SquareTerminal, UsersRound } from "lucide-react";
import type { SettingsSection } from "./settings.types";
import type { Theme } from "../git/workspace.types";

export const SETTINGS_SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Monitor },
  { id: "accounts", label: "GitHub accounts", icon: UsersRound },
  { id: "environment", label: "Git environment", icon: SquareTerminal },
] satisfies { id: SettingsSection; label: string; icon: typeof Monitor }[];

export const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] satisfies { value: Theme; label: string }[];
