import type { DialogKind } from "./workspace.types";

export type SyncAction = { kind: DialogKind | "pull"; label: string; title: string };
