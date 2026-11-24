import { REPOSITORIES_KEY } from "./workspace.constants";
import type { Status, SyncState } from "./bindings";
import type { DialogKind, Theme } from "./workspace.types";

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

export function syncAction(status: Status, sync: SyncState): { kind: DialogKind | "pull"; label: string } | null {
  if (sync.remotes.length === 0) return null;
  if (status.branch && !status.isUnborn) {
    if (!sync.hasConfiguredUpstream) return { kind: "publish", label: "Publish branch" };
    const target = sync.pushTarget;
    if (target && sync.pushAhead !== null && sync.pushAhead > 0) {
      const destination = `${target.remote}/${target.reference.slice("refs/heads/".length)}`;
      if (destination !== status.upstream) return { kind: "push", label: "Push" };
    }
    if (status.hasUpstreamRef && status.behind > 0 && status.ahead === 0) return { kind: "pull", label: "Pull" };
    if (sync.pushTarget && status.hasUpstreamRef && status.behind === 0 && sync.pushAhead !== 0) {
      return { kind: "push", label: "Push" };
    }
  }
  return { kind: "fetch", label: "Fetch" };
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
