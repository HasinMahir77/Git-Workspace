import { LANGUAGES, LANGUAGE_BY_EXTENSION } from "./syntax.constants";
import type { Language } from "./syntax.types";

/** The highlighting rules for a file path, or null when the file type is not known. A rename shows its new name. */
export function languageOf(path: string | undefined): Language | null {
  const name = path?.split(" → ").pop()?.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  const key = dot > 0 ? LANGUAGE_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] : undefined;
  return key ? LANGUAGES[key] ?? null : null;
}
