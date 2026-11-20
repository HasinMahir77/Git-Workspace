import { GitCommitHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { git } from "../git/client";
import { cherryPickSummary } from "../git/recovery.helpers";
import type { CherryPickOntoProps } from "./cherry-pick-onto.types";

export function CherryPickOnto({ repo, commit, current, isBusy, isDirty, run }: CherryPickOntoProps) {
  const [destinations, setDestinations] = useState<string[]>([]);
  const [destination, setDestination] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    void git.branchGroups(repo).then((groups) => { if (isCurrent) setDestinations(groups.local.filter((name) => name !== current)); })
      .catch(() => { if (isCurrent) setDestinations([]); });
    return () => { isCurrent = false; };
  }, [repo, current]);
  useEffect(() => setIsConfirming(false), [commit.id, destination]);

  if (destinations.length === 0) return null;
  return (
    <div className="merge-row row">
      <label className="row"><span>Cherry-pick onto</span>
        <select className="field" value={destination} onChange={(event) => setDestination(event.target.value)}>
          <option value="" disabled>Choose a local branch</option>
          {destinations.map((name) => <option key={name}>{name}</option>)}
        </select>
      </label>
      {!isConfirming ? (
        <button className="button" disabled={!destination || isBusy} onClick={() => setIsConfirming(true)}><GitCommitHorizontal size={15} /> Cherry-pick onto…</button>
      ) : isDirty ? (
        <span role="alert">Switching branches needs a clean working tree. Commit your changes first.</span>
      ) : (
        <>
          <strong>{cherryPickSummary(commit.id.slice(0, 8), commit.summary, destination)}</strong>
          <span className="muted">{destination} will be checked out and stay checked out if you abort.</span>
          <button className="button primary" disabled={isBusy} onClick={() => {
            setIsConfirming(false);
            void run({ type: "cherryPick", commit: commit.id, destination }, "Cherry-pick");
          }}>Cherry-pick</button>
          <button className="button subtle" onClick={() => setIsConfirming(false)}>Cancel</button>
        </>
      )}
    </div>
  );
}
