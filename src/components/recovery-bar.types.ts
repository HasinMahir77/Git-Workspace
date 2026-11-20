import type { Recovery } from "../git/bindings";
import type { RunOperation } from "../git/workspace.types";

export type RecoveryBarProps = {
  recovery: Recovery & { kind: NonNullable<Recovery["kind"]> };
  isBusy: boolean;
  run: RunOperation;
  openTerminal: () => void;
};
