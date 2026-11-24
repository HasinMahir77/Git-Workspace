// Kept here, not in a constants file: node's test runner cannot resolve extensionless runtime imports.
const COMMIT_TYPES = ["feat", "fix", "chore", "docs", "test", "refactor", "style", "perf", "build", "ci", "revert"];
const DEFAULT_COMMIT_TYPE = "feat";
const MAX_SUMMARY_LENGTH = 100;
const MIN_HISTORY_SAMPLE = 3;
const CONVENTION_SHARE = 0.6;
const TICKET_PATTERN = /([A-Za-z][A-Za-z0-9]+-\d+)/;
const CONVENTIONAL_PATTERN = new RegExp(`^(${COMMIT_TYPES.join("|")})(\\([A-Za-z0-9._/-]+\\))?!?: \\S`);

export function ticketFromBranch(branch: string | null): string | null {
  return branch?.match(TICKET_PATTERN)?.[1]?.toUpperCase() ?? null;
}

/** `feat(GH-12): ` for a branch like `fix/GH-12-login`, or null when the branch names no ticket. */
export function messageTemplate(branch: string | null): string | null {
  const ticket = ticketFromBranch(branch);
  if (!ticket) return null;
  const prefix = branch?.split("/")[0] ?? "";
  return `${COMMIT_TYPES.includes(prefix) ? prefix : DEFAULT_COMMIT_TYPE}(${ticket}): `;
}

/** A hint for a summary that a conventional-commit hook would reject, or null when it looks fine. */
export function commitMessageIssue(summary: string): string | null {
  const text = summary.trim();
  if (!text) return null;
  if (!CONVENTIONAL_PATTERN.test(text)) return "Use the format type(TICKET-123): summary, like feat(GH-12): add login.";
  if (text.length > MAX_SUMMARY_LENGTH) return `Keep the summary to ${MAX_SUMMARY_LENGTH} characters or fewer (now ${text.length}).`;
  return null;
}

/** True when most recent commits follow the type(scope): summary format. */
export function usesConventionalCommits(summaries: string[]): boolean {
  if (summaries.length < MIN_HISTORY_SAMPLE) return false;
  return summaries.filter((summary) => CONVENTIONAL_PATTERN.test(summary)).length / summaries.length >= CONVENTION_SHARE;
}
