import type { Recovery } from "../git/bindings";
import type { RunOperation } from "../git/workspace.types";

export type RecoveryBarProps = {
  repo: string;
  recovery: Recovery & { kind: NonNullable<Recovery["kind"]> };
  isBusy: boolean;
  run: RunOperation;
  openTerminal: () => void;
};
