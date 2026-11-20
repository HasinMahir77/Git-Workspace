import { Channel, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { BranchGroups, Commit, CommitFile, Comparison, Recovery, StashEntry, Operation, RepositoryInfo, Status, SyncState, ToolVersion } from "./bindings";

function outputChannel(emit: (line: string) => void) {
  const channel = new Channel<string>();
  channel.onmessage = emit;
  return channel;
}

export const git = {
  browse: () => open({ directory: true, multiple: false }),
  open: (path: string) => invoke<RepositoryInfo>("open_repository", { path }),
  clone: (parent: string, name: string, source: string, emit: (line: string) => void) =>
    invoke<RepositoryInfo>("clone_repository", { parent, name, source, output: outputChannel(emit) }),
  status: (repo: string) => invoke<Status>("get_status", { repo }),
  syncState: (repo: string) => invoke<SyncState>("get_sync_state", { repo }),
  branches: (repo: string) => invoke<string[]>("get_branches", { repo }),
  branchGroups: (repo: string) => invoke<BranchGroups>("get_branch_groups", { repo }),
  compare: (repo: string, other: string) => invoke<Comparison>("compare_branches", { repo, other }),
  recovery: (repo: string) => invoke<Recovery>("get_recovery", { repo }),
  stashes: (repo: string) => invoke<StashEntry[]>("get_stashes", { repo }),
  diff: (repo: string, file: string, isStaged: boolean) => invoke<string>("get_diff", { repo, file, isStaged }),
  history: (repo: string, offset: number) => invoke<Commit[]>("get_history", { repo, offset }),
  commitDiff: (repo: string, commit: string, paths: string[] = []) => invoke<string>("get_commit_diff", { repo, commit, paths }),
  commitFiles: (repo: string, commit: string) => invoke<CommitFile[]>("get_commit_files", { repo, commit }),
  run: (repo: string, operation: Operation, emit: (line: string) => void) =>
    invoke<void>("run_operation", { repo, operation, output: outputChannel(emit) }),
  cancel: (repo: string) => invoke<void>("cancel_operation", { repo }),
  tools: (repo?: string) => invoke<ToolVersion[]>("tool_versions", { repo }),
  terminal: (repo: string) => invoke<void>("open_terminal", { repo }),
  externalEditor: () => invoke<string | null>("external_editor"),
  reveal: (repo: string, path?: string) => invoke<void>("reveal_in_file_manager", { repo, path: path ?? null }),
  openInEditor: (repo: string, path?: string) => invoke<void>("open_in_editor", { repo, path: path ?? null }),
  openDefault: (repo: string, path: string) => invoke<void>("open_with_default_program", { repo, path }),
  openOnGitHub: (repo: string, commit?: string) => invoke<void>("open_on_github", { repo, commit: commit ?? null }),
  hasGitHubRemote: (repo: string) => invoke<boolean>("has_github_remote", { repo }),
};
