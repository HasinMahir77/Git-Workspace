import type { DiffOptions } from "./bindings";

const DEFAULTS: DiffOptions = { shouldIgnoreWhitespace: false, contextLines: null };

/** Staging works on the default diff, so a changed view is read-only. */
export function isDefaultDiffOptions(options: DiffOptions): boolean {
  return !options.shouldIgnoreWhitespace && options.contextLines === null;
}

export function readDiffOptions(raw: string | null): DiffOptions {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (typeof value !== "object" || value === null) return DEFAULTS;
    const { shouldIgnoreWhitespace, contextLines } = value as Record<string, unknown>;
    return {
      shouldIgnoreWhitespace: shouldIgnoreWhitespace === true,
      contextLines: typeof contextLines === "number" && Number.isInteger(contextLines) && contextLines > 0 ? contextLines : null,
    };
  } catch {
    return DEFAULTS;
  }
}
