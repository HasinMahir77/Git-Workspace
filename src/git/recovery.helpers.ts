export function mergeSummary(other: string, current: string | null) {
  return `Merge ${other} into ${current ?? "the checked-out commit"}`;
}

export function canContinueRecovery(unmergedCount: number, isBusy: boolean) {
  return unmergedCount === 0 && !isBusy;
}

export function rebaseSummary(current: string | null, onto: string, replayCount: number) {
  const commits = `${replayCount} local ${replayCount === 1 ? "commit" : "commits"}`;
  return `Rebase ${current ?? "the checked-out commit"} onto ${onto}. Git will replay up to ${commits} and may skip ones the target already has. Commit IDs change.`;
}

export function cherryPickSummary(shortId: string, subject: string, destination: string | null) {
  return `Cherry-pick ${shortId} "${subject}" into ${destination ?? "the checked-out commit"}`;
}

export function localNameFor(remoteBranch: string) {
  const slash = remoteBranch.indexOf("/");
  return slash < 0 ? remoteBranch : remoteBranch.slice(slash + 1);
}
