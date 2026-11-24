import { useEffect, useState } from "react";
import { git } from "./client";
import type { PullRequest } from "./bindings";

const REFRESH_MS = 5 * 60_000;

/** The open pull request for the branch, checked again every few minutes. Failures read as "none". */
export function usePullRequest(repo: string, branch: string | null, isEnabled: boolean): PullRequest | null {
  const [state, setState] = useState<{ key: string; pullRequest: PullRequest | null } | null>(null);
  const key = `${repo}:${branch}`;

  useEffect(() => {
    if (!isEnabled || !branch) return;
    let isCurrent = true;
    const load = () => void git.pullRequest(repo).then((pullRequest) => { if (isCurrent) setState({ key, pullRequest }); })
      .catch(() => { if (isCurrent) setState({ key, pullRequest: null }); });
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => { isCurrent = false; window.clearInterval(timer); };
  }, [repo, branch, isEnabled, key]);

  return isEnabled && state?.key === key ? state.pullRequest : null;
}
