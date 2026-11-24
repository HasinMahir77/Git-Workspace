import { ArrowDownIcon, ArrowUpIcon, SyncIcon, UploadIcon } from "@primer/octicons-react";
import type { Icon } from "@primer/octicons-react";
import { useEffect, useState } from "react";
import { LAST_FETCHED_TICK_MS } from "../git/sync.constants";
import { lastFetchedLabel } from "../git/sync.helpers";
import type { SyncAction } from "../git/sync.types";
import { ToolbarButton } from "./ToolbarButton";
import type { SyncButtonProps } from "./sync-button.types";

const ICONS: Partial<Record<SyncAction["kind"], Icon>> = { fetch: SyncIcon, pull: ArrowDownIcon, push: ArrowUpIcon, publish: UploadIcon };

export function SyncButton({ action, status, fetchRemote, lastFetch, isBusy, activate, fetch }: SyncButtonProps) {
  const [now, setNow] = useState(() => Date.now());
  const Icon = ICONS[action.kind] ?? SyncIcon;
  const hasAheadBehind = status.hasUpstreamRef && (status.ahead > 0 || status.behind > 0);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), LAST_FETCHED_TICK_MS);
    return () => window.clearInterval(timer);
  }, [lastFetch]);

  return (
    <div className="toolbar-sync">
      <ToolbarButton className="sync-control" icon={<Icon />} text={action.title} description={lastFetchedLabel(lastFetch, now)}
        aria-label={action.label} disabled={isBusy} onClick={activate}
        badge={hasAheadBehind ? (
          <span className="ahead-behind" aria-label={`${status.behind} behind, ${status.ahead} ahead`}>
            {status.behind > 0 ? <span>{status.behind}<ArrowDownIcon size={10} /></span> : null}
            {status.ahead > 0 ? <span>{status.ahead}<ArrowUpIcon size={10} /></span> : null}
          </span>
        ) : null} />
      {action.kind !== "fetch" && fetchRemote ? (
        <button type="button" className="toolbar-arrow-button" aria-label="Fetch" title={`Fetch ${fetchRemote}`} disabled={isBusy} onClick={fetch}>
          <SyncIcon />
        </button>
      ) : null}
    </div>
  );
}
