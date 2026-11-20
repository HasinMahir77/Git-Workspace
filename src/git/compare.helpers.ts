import type { BranchGroups } from "./bindings";

export function defaultCompareTarget(upstream: string | null, groups: BranchGroups, current: string | null): string | null {
  if (!upstream) return null;
  const isKnown = groups.local.includes(upstream) || groups.remote.includes(upstream);
  return isKnown && upstream !== current ? upstream : null;
}

export function mergeBaseLabel(mergeBase: string | null) {
  return mergeBase ? `Merge base ${mergeBase.slice(0, 8)}` : "No merge base";
}
