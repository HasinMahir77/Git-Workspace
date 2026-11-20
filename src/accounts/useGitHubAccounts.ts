import { useCallback, useEffect, useRef, useState } from "react";
import type { GitHubAccounts } from "../git/bindings";
import { messageOf } from "../git/workspace.helpers";
import { github } from "./client";

export function useGitHubAccounts() {
  const [state, setState] = useState<GitHubAccounts | null>(null);
  const [error, setError] = useState("");
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const latest = ++request.current;
    try {
      const accounts = await github.accounts();
      if (latest === request.current) {
        setState(accounts);
        setError("");
      }
    } catch (reason) {
      if (latest === request.current) {
        setState(null);
        setError(messageOf(reason));
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      request.current += 1;
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return { state, error, refresh, active: state?.accounts.find((account) => account.isActive) };
}
