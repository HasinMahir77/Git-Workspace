import { useCallback, useEffect, useRef, useState } from "react";
import { git } from "./client";
import type { Operation, RepositoryInfo } from "./bindings";
import type { Repositories, Snapshot } from "./workspace.types";
import { ACTIVE_REPOSITORY_KEY, MAX_OUTPUT_LENGTH, REPOSITORIES_KEY } from "./workspace.constants";
import { messageOf, readSavedPaths } from "./workspace.helpers";

export function useWorkspace() {
  const [repositories, setRepositories] = useState<Repositories>({ entries: [], selected: null });
  const [hasRestored, setHasRestored] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [operation, setOperation] = useState("");
  const [output, setOutput] = useState("");
  const [hasOutputOpen, setHasOutputOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [fetchTimes, setFetchTimes] = useState<Record<string, number>>({});
  const isRunning = useRef(false);
  const selected = repositories.entries.find((entry) => entry.id === repositories.selected);
  const repo = selected?.id;
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let isCurrent = true;
    const activePath = localStorage.getItem(ACTIVE_REPOSITORY_KEY);
    void Promise.allSettled(readSavedPaths().map((path) => git.open(path))).then((results) => {
      if (!isCurrent) return;
      const entries = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      setRepositories({
        entries,
        selected: entries.find((entry) => entry.path === activePath)?.id ?? entries[0]?.id ?? null,
      });
      setHasRestored(true);
    });
    return () => { isCurrent = false; };
  }, []);

  useEffect(() => {
    if (!hasRestored) return;
    localStorage.setItem(REPOSITORIES_KEY, JSON.stringify(repositories.entries.map((entry) => entry.path)));
    localStorage.setItem(ACTIVE_REPOSITORY_KEY, selected?.path ?? "");
  }, [hasRestored, repositories.entries, selected?.path]);

  useEffect(() => {
    if (!repo) return;
    let isCurrent = true;
    void git.status(repo).then((status) => {
      if (isCurrent) setSnapshot((value) => ({ repo, status, sync: value?.repo === repo ? value.sync : null }));
    }).catch((reason: unknown) => {
      if (isCurrent) setError(messageOf(reason));
    });
    void git.syncState(repo).then((sync) => {
      if (isCurrent) setSnapshot((value) => ({ repo, sync, status: value?.repo === repo ? value.status : null }));
    }).catch((reason: unknown) => {
      if (isCurrent) {
        setSnapshot((value) => ({ repo, sync: null, status: value?.repo === repo ? value.status : null }));
        setError(messageOf(reason));
      }
    });
    return () => { isCurrent = false; };
  }, [repo, revision, hasRestored]);

  useEffect(() => {
    const onFocus = () => { if (!isRunning.current) refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  function select(id: string) {
    setError("");
    setRepositories((previous) => ({ ...previous, selected: id }));
  }

  function remove(id: string) {
    setRepositories((previous) => {
      const entries = previous.entries.filter((entry) => entry.id !== id);
      return { entries, selected: previous.selected === id ? entries[0]?.id ?? null : previous.selected };
    });
  }

  function register(entry: RepositoryInfo) {
    setRepositories((previous) => ({
      entries: previous.entries.some((existing) => existing.id === entry.id) ? previous.entries : [...previous.entries, entry],
      selected: entry.id,
    }));
  }

  async function run<T>(label: string, work: (emit: (line: string) => void) => Promise<T>, shouldShowOutput = true) {
    if (isRunning.current) return null;
    isRunning.current = true;
    setError("");
    setOperation(label);
    setOutput("");
    setHasOutputOpen(shouldShowOutput);
    try {
      const result = await work((line) => setOutput((previous) => (previous + line).slice(-MAX_OUTPUT_LENGTH)));
      if (shouldShowOutput) {
        setOutput((previous) => previous || `${label} completed.\n`);
        setHasOutputOpen(false);
      }
      return { result };
    } catch (reason: unknown) {
      setError(messageOf(reason));
      setHasOutputOpen(shouldShowOutput);
      return null;
    } finally {
      isRunning.current = false;
      setOperation("");
      refresh();
    }
  }

  async function open(path: string) {
    const result = await run("Open repository", () => git.open(path), false);
    if (result) register(result.result);
    return Boolean(result);
  }

  async function clone(parent: string, name: string, source: string) {
    const result = await run("Clone repository", (emit) => git.clone(parent, name, source, emit));
    if (result) register(result.result);
    return Boolean(result);
  }

  async function init(parent: string, name: string) {
    const result = await run("Create repository", () => git.init(parent, name), false);
    if (result) register(result.result);
    return Boolean(result);
  }

  async function mutate(request: Operation, label: string) {
    if (!repo || isRunning.current) return false;
    const canCancel = !["stage", "unstage", "stageHunk", "unstageHunk", "discard", "addToGitignore", "addRemote"].includes(request.type);
    setCancelTarget(canCancel ? repo : null);
    const result = await run(label, (emit) => git.run(repo, request, emit), canCancel);
    setCancelTarget(null);
    setIsCancelling(false);
    if (result && (request.type === "fetch" || request.type === "pull")) {
      setFetchTimes((times) => ({ ...times, [repo]: Date.now() }));
    }
    return Boolean(result);
  }

  async function cancel() {
    if (!cancelTarget || isCancelling) return;
    setIsCancelling(true);
    try {
      await git.cancel(cancelTarget);
    } catch (reason: unknown) {
      setError(messageOf(reason));
      setIsCancelling(false);
    }
  }

  return {
    entries: repositories.entries,
    selected,
    snapshot: snapshot?.repo === repo ? snapshot : null,
    hasRestored,
    lastFetch: repo ? fetchTimes[repo] : undefined,
    error, setError, revision, refresh, operation, output, hasOutputOpen, setHasOutputOpen,
    select, remove, open, clone, init, mutate, canCancel: Boolean(cancelTarget), isCancelling, cancel,
  };
}
