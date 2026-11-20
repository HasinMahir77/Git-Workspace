export type DiffLine = {
  number: number;
  text: string;
  kind: "context" | "addition" | "deletion";
};

export type DiffRow = { meta: string } | { left: DiffLine | null; right: DiffLine | null };
