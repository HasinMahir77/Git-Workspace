import { REPOSITORIES_KEY } from "./workspace.constants";
import type { Status, SyncState } from "./bindings";
import type { Theme } from "./workspace.types";

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function readSavedPaths(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(REPOSITORIES_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function upstreamLabel(status: Status, sync: SyncState | null): string {
  if (!status.branch) return "Detached HEAD";
  if (status.isUnborn) return "No commits yet";
  if (sync?.hasConfiguredUpstream && !status.hasUpstreamRef) return "Upstream unavailable";
  if (!status.upstream) return "No upstream";
  if (status.ahead && status.behind) return `${status.upstream} · diverged`;
  if (status.ahead) return `${status.upstream} · ${status.ahead} ahead`;
  if (status.behind) return `${status.upstream} · ${status.behind} behind`;
  return status.upstream;
}

export function getTheme(value: string | null): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
