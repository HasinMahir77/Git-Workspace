import type { IntegrationKind } from "./bindings";

export const RECOVERY_COPY: Record<IntegrationKind, { title: string; continueLabel: string; abortLabel: string; discardLabel: string; keepLabel: string; hasSkip: boolean; abortNote?: string }> = {
  merge: {
    title: "Merge in progress",
    continueLabel: "Continue merge",
    abortLabel: "Abort merge",
    discardLabel: "Discard merge",
    keepLabel: "Keep merging",
    hasSkip: false,
  },
  rebase: {
    title: "Rebase in progress",
    continueLabel: "Continue rebase",
    abortLabel: "Abort rebase",
    discardLabel: "Discard rebase",
    keepLabel: "Keep rebasing",
    hasSkip: true,
  },
  cherryPick: {
    title: "Cherry-pick in progress",
    continueLabel: "Continue cherry-pick",
    abortLabel: "Abort cherry-pick",
    discardLabel: "Discard cherry-pick",
    keepLabel: "Keep going",
    hasSkip: true,
    abortNote: "Aborting keeps the destination branch checked out.",
  },
};
