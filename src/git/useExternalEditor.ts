import { useEffect, useState } from "react";
import { git } from "./client";

export function useExternalEditor(): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => { void git.externalEditor().then(setLabel).catch(() => setLabel(null)); }, []);
  return label;
}
