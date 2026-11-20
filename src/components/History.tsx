import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { git } from "../git/client";
import type { Commit } from "../git/bindings";
import { HISTORY_PAGE_SIZE } from "../git/workspace.constants";
import { messageOf } from "../git/workspace.helpers";
import { DiffPanel } from "./DiffPanel";
import { HISTORY } from "./sidebar.constants";
import { WorkspaceSplit } from "./WorkspaceSplit";

export function History({ repo, revision, tabs }: { repo: string; revision: number; tabs: ReactNode }) {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [selected, select] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ id: string; patch: string; error?: string } | null>(null);
  const commit = commits.find((entry) => entry.id === selected) ?? commits[0];
  const id = commit?.id;

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError("");
    void git.history(repo, 0).then((page) => {
      if (!isCurrent) return;
      setCommits(page);
      setHasMore(page.length === HISTORY_PAGE_SIZE);
    }).catch((reason: unknown) => {
      if (isCurrent) setError(messageOf(reason));
    }).finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [repo, revision]);

  useEffect(() => {
    if (!id) return;
    let isCurrent = true;
    void git.commitDiff(repo, id).then((patch) => {
      if (isCurrent) setPreview({ id, patch });
    }).catch((reason: unknown) => {
      if (isCurrent) setPreview({ id, patch: "", error: messageOf(reason) });
    });
    return () => { isCurrent = false; };
  }, [repo, id]);

  async function loadMore() {
    setIsLoading(true);
    setError("");
    try {
      const page = await git.history(repo, commits.length);
      setCommits((previous) => [...previous, ...page.filter((entry) => !previous.some((existing) => existing.id === entry.id))]);
      setHasMore(page.length === HISTORY_PAGE_SIZE);
    } catch (reason: unknown) {
      setError(messageOf(reason));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <WorkspaceSplit config={HISTORY} label="Commits" tabs={tabs} preview={
        <DiffPanel title={commit?.summary} detail={id?.slice(0, 8)} isHistory
          patch={id && preview?.id === id ? preview.patch : null} error={id && preview?.id === id ? preview.error : undefined} />
    }>
      <div className="file-list">
        {error && <div role="alert" className="banner"><p>{error}</p></div>}
        {commits.length === 0 && !error && <div className="empty">{isLoading ? "Loading history" : "No commits yet"}</div>}
        {commits.map((entry) => (
          <button className="history-item" aria-pressed={entry.id === id} key={entry.id} onClick={() => select(entry.id)}>
            <strong className="truncate">{entry.summary}</strong>
            <small><span className="truncate">{entry.author}</span><time dateTime={entry.date}>{entry.date}</time></small>
          </button>
        ))}
        {hasMore && <div className="history-more"><button className="button" disabled={isLoading} onClick={() => void loadMore()}>Load more commits</button></div>}
      </div>
    </WorkspaceSplit>
  );
}
