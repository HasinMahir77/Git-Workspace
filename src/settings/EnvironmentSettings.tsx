import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { ToolVersion } from "../git/bindings";
import { git } from "../git/client";
import { messageOf } from "../git/workspace.helpers";

export function EnvironmentSettings({ repositoryId }: { repositoryId?: string }) {
  const [tools, setTools] = useState<ToolVersion[] | null>(null);
  const [error, setError] = useState("");
  const [revision, refresh] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setTools(null);
    setError("");
    void git.tools(repositoryId).then((versions) => {
      if (isCurrent) setTools(versions);
    }).catch((reason) => {
      if (isCurrent) setError(messageOf(reason));
    });
    return () => { isCurrent = false; };
  }, [repositoryId, revision]);

  return (
    <div className="settings-stack">
      <p className="muted">Git and hooks inherit this app’s environment. If a tool is missing, launch <code>git-workspace</code> from your working terminal.</p>
      {error && <p role="alert" className="dialog-error">{error}</p>}
      {!tools && !error && <p role="status" className="muted">Checking tools…</p>}
      {tools && (
        <dl className="diagnostic settings-card">
          {tools.map((tool) => (
            <div className="diagnostic-row" key={tool.name}>
              <dt><code>{tool.name}</code></dt>
              <dd>{tool.version ?? "Unavailable on this PATH"}</dd>
            </div>
          ))}
        </dl>
      )}
      <button className="button" disabled={!tools && !error} onClick={() => refresh((value) => value + 1)}>
        <RefreshCw size={15} aria-hidden="true" /> Check again
      </button>
    </div>
  );
}
