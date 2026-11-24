import type { Status, SyncState } from "./bindings";
import type { SyncAction } from "./sync.types";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "always" });

export function syncAction(status: Status, sync: SyncState): SyncAction | null {
  if (sync.remotes.length === 0) return null;
  const fetch: SyncAction = { kind: "fetch", label: "Fetch", title: `Fetch ${sync.fetchRemote ?? sync.remotes[0]}` };
  if (!status.branch || status.isUnborn) return fetch;
  if (!sync.hasConfiguredUpstream) return { kind: "publish", label: "Publish branch", title: "Publish branch" };
  const target = sync.pushTarget;
  const push: SyncAction | null = target ? { kind: "push", label: "Push", title: `Push ${target.remote}` } : null;
  if (push && target && sync.pushAhead !== null && sync.pushAhead > 0) {
    const destination = `${target.remote}/${target.reference.slice("refs/heads/".length)}`;
    if (destination !== status.upstream) return push;
  }
  if (status.hasUpstreamRef && status.behind > 0 && status.ahead === 0) {
    return { kind: "pull", label: "Pull", title: `Pull ${sync.fetchRemote ?? sync.remotes[0]}` };
  }
  if (push && status.hasUpstreamRef && status.behind === 0 && sync.pushAhead !== 0) return push;
  return fetch;
}

export function lastFetchedLabel(fetchedAt: number | undefined, now: number): string | undefined {
  if (fetchedAt === undefined) return undefined;
  const elapsed = Math.max(0, now - fetchedAt);
  if (elapsed < MINUTE_MS) return "Last fetched just now";
  if (elapsed < HOUR_MS) return `Last fetched ${relativeTime.format(-Math.floor(elapsed / MINUTE_MS), "minute")}`;
  if (elapsed < DAY_MS) return `Last fetched ${relativeTime.format(-Math.floor(elapsed / HOUR_MS), "hour")}`;
  return `Last fetched ${relativeTime.format(-Math.floor(elapsed / DAY_MS), "day")}`;
}
