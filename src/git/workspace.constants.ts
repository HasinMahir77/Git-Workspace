import type { Draft } from "./workspace.types";

export const EMPTY_DRAFT: Draft = { summary: "", body: "" };
export const HISTORY_PAGE_SIZE = 30;
export const MAX_OUTPUT_LENGTH = 90_000;
export const REPOSITORIES_KEY = "git-gui.repositories";
export const ACTIVE_REPOSITORY_KEY = "git-gui.active";
export const THEME_KEY = "git-gui.theme";
export const BACKGROUND_FETCH_MS = 5 * 60_000;
export const FIRST_BACKGROUND_FETCH_MS = 3_000;
