import { GitCompare, GitMerge, GitPullRequestArrow, X } from "lucide-react";
import { useEffect, useState } from "react";
import { git } from "../git/client";
import type { BranchGroups, Commit, Comparison } from "../git/bindings";
import { defaultCompareTarget, mergeBaseLabel } from "../git/compare.helpers";
import { cherryPickSummary, mergeSummary, rebaseSummary } from "../git/recovery.helpers";
import { messageOf } from "../git/workspace.helpers";
import type { ComparePanelProps } from "./compare-panel.types";
import { DiffPanel } from "./DiffPanel";

export function ComparePanel({ repo, current, upstream, revision, isBusy, isDirty, isPaused, run, openChanges, close }: ComparePanelProps) {
  const [groups, setGroups] = useState<BranchGroups | null>(null);
  const [other, setOther] = useState("");
  const [result, setResult] = useState<{ other: string; comparison: Comparison } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void git.branchGroups(repo).then((next) => {
      if (!isCurrent) return;
      setGroups(next);
      setOther((value) => value || defaultCompareTarget(upstream, next, current) || "");
    }).catch((reason: unknown) => { if (isCurrent) setError(messageOf(reason)); });
    return () => { isCurrent = false; };
  }, [repo, upstream, current, revision]);

  useEffect(() => {
    if (!other) return;
    let isCurrent = true;
    setError("");
    void git.compare(repo, other).then((comparison) => { if (isCurrent) setResult({ other, comparison }); })
      .catch((reason: unknown) => { if (isCurrent) { setResult(null); setError(messageOf(reason)); } });
    return () => { isCurrent = false; };
  }, [repo, other, revision]);

  useEffect(() => setPending(null), [other, revision]);

  const comparison = result?.other === other ? result.comparison : null;
  const canMerge = Boolean(current) && comparison?.mergeBase != null && !isBusy && !isPaused;
  const options = groups ? [...groups.local.filter((name) => name !== current), ...groups.remote] : [];
  return (
    <section className="compare-panel" aria-label="Compare branches">
      <div className="compare-heading row">
        <GitCompare size={16} aria-hidden="true" />
        <label className="compare-field"><small>Current branch</small>
          <strong className="truncate">{current ?? "Detached HEAD"}</strong>
        </label>
        <label className="compare-field"><small>Compare with</small>
          <select className="field" value={other} onChange={(event) => setOther(event.target.value)}>
            <option value="" disabled>Choose a branch</option>
            {groups && groups.local.some((name) => name !== current) && <optgroup label="Local">
              {groups.local.filter((name) => name !== current).map((name) => <option key={name}>{name}</option>)}
            </optgroup>}
            {groups && groups.remote.length > 0 && <optgroup label="Remote">
              {groups.remote.map((name) => <option key={name}>{name}</option>)}
            </optgroup>}
          </select>
        </label>
        <span className="spacer" />
        <button className="button icon subtle" aria-label="Close comparison" title="Close comparison" onClick={close}><X size={16} /></button>
      </div>
      {error && <div className="banner" role="alert"><p>{error}</p></div>}
      {!other && !error && <div className="empty"><GitCompare size={25} aria-hidden="true" />
        <h2>{options.length === 0 && groups ? "No other branches to compare" : "Choose a branch to compare"}</h2></div>}
      {comparison && (
        <div className="compare-body">
          <div className="compare-commits">
            <CommitColumn title={`Only in ${comparison.current}`} commits={comparison.currentOnly} />
            <CommitColumn title={`Only in ${comparison.other}`} commits={comparison.otherOnly}
              pick={canMerge ? (commit) => setPending({ kind: "cherryPick", commit }) : undefined} />
          </div>
          <div className="merge-row row">
            {!pending ? (
              <>
                <button className="button" disabled={!canMerge} onClick={() => setPending({ kind: "merge" })}
                  title={comparison.mergeBase === null ? "These branches share no history." : undefined}><GitMerge size={15} /> Merge into current branch</button>
                <button className="button" disabled={!canMerge} onClick={() => setPending({ kind: "rebase" })}
                  title={comparison.mergeBase === null ? "These branches share no history." : undefined}><GitPullRequestArrow size={15} /> Rebase current branch onto…</button>
              </>
            ) : isDirty ? (
              <>
                <span role="alert">This needs a clean working tree. Commit your changes first.</span>
                <button className="button" onClick={openChanges}>Go to Changes</button>
                <button className="button subtle" onClick={() => setPending(null)}>Cancel</button>
              </>
            ) : (
              <>
                <strong>{describe(pending, comparison, current)}</strong>
                <button className="button primary" disabled={!canMerge} onClick={() => {
                  setPending(null);
                  if (pending.kind === "merge") void run({ type: "merge", other: comparison.other, expectedId: comparison.otherId }, "Merge");
                  else if (pending.kind === "rebase") void run({ type: "rebase", onto: comparison.other, expectedId: comparison.otherId }, "Rebase");
                  else void run({ type: "cherryPick", commit: pending.commit.id, destination: null }, "Cherry-pick");
                }}>{pending.kind === "merge" ? "Merge" : pending.kind === "rebase" ? "Rebase" : "Cherry-pick"}</button>
                <button className="button subtle" onClick={() => setPending(null)}>Cancel</button>
              </>
            )}
            {isPaused && <span className="muted">Finish the operation in progress first.</span>}
          </div>
          {comparison.mergeBase === null && <div className="banner" role="alert">
            <p>These branches share no history, so there is no merge base to compare from.</p></div>}
          <DiffPanel isHistory title={`Changes in ${comparison.other}`} detail={mergeBaseLabel(comparison.mergeBase)}
            patch={comparison.diff} />
        </div>
      )}
    </section>
  );
}

function CommitColumn({ title, commits, pick }: { title: string; commits: Comparison["currentOnly"]; pick?: (commit: Commit) => void }) {
  return (
    <div className="compare-column">
      <h3 className="truncate" title={title}>{title} <span className="count">{commits.length}</span></h3>
      <ul>
        {commits.length === 0 && <li className="muted">No unique commits</li>}
        {commits.map((commit) => (
          <li key={commit.id}><strong className="truncate">{commit.summary}</strong>
            <small><code>{commit.id.slice(0, 8)}</code> <span className="truncate">{commit.author}</span>
              {pick && <button className="button subtle" onClick={() => pick(commit)}>Cherry-pick into current branch</button>}</small></li>
        ))}
      </ul>
    </div>
  );
}

type Pending = { kind: "merge" } | { kind: "rebase" } | { kind: "cherryPick"; commit: Commit };

function describe(pending: Pending, comparison: Comparison, current: string | null) {
  if (pending.kind === "merge") return mergeSummary(comparison.other, current);
  if (pending.kind === "rebase") return rebaseSummary(current, comparison.other, comparison.currentOnly.length);
  return cherryPickSummary(pending.commit.id.slice(0, 8), pending.commit.summary, current);
}
