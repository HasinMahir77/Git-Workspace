import { useEffect, useState } from "react";
import { git } from "./client";
import type { Recovery } from "./bindings";

export function useRecovery(repo: string | undefined, revision: number) {
  const [state, setState] = useState<{ repo: string; recovery: Recovery } | null>(null);
  useEffect(() => {
    if (!repo) return;
    let isCurrent = true;
    void git.recovery(repo).then((recovery) => { if (isCurrent) setState({ repo, recovery }); })
      .catch(() => { if (isCurrent) setState(null); });
    return () => { isCurrent = false; };
  }, [repo, revision]);
  return state && state.repo === repo ? state.recovery : null;
}
