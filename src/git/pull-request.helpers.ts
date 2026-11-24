import type { PullRequest } from "./bindings";

const CHECK_LABELS = { none: "", pending: "checks running", failing: "checks failing", passing: "checks passing" } as const;
const DEFAULT_BRANCHES = ["main", "master"];

/** "Open, checks failing" for the toolbar subtitle. */
export function pullRequestDescription(pullRequest: PullRequest): string {
  const state = pullRequest.isDraft ? "Draft" : pullRequest.state.charAt(0) + pullRequest.state.slice(1).toLowerCase();
  const checks = pullRequest.state === "OPEN" ? CHECK_LABELS[pullRequest.checks] : "";
  return checks ? `${state}, ${checks}` : state;
}

/** Whether the toolbar should offer to start a pull request for this branch. */
export function canCreatePullRequest(branch: string | null, hasUpstream: boolean): boolean {
  return branch !== null && hasUpstream && !DEFAULT_BRANCHES.includes(branch);
}
