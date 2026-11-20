import { GitCommitHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cherryPickSummary } from "../git/recovery.helpers";
import type { CherryPickOntoProps } from "./cherry-pick-onto.types";

export function CherryPickOnto({ commit, destinations, focusKey, isBusy, isDirty, run }: CherryPickOntoProps) {
  const [destination, setDestination] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const select = useRef<HTMLSelectElement>(null);

  useEffect(() => setIsConfirming(false), [commit.id, destination]);
  useEffect(() => { if (focusKey > 0) select.current?.focus(); }, [focusKey]);

  if (destinations.length === 0) return null;
  return (
    <div className="merge-row row">
      <label className="row"><span>Cherry-pick onto</span>
        <select className="field" ref={select} value={destination} onChange={(event) => setDestination(event.target.value)}>
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
