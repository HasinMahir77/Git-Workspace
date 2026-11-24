export type SyntaxKind = "plain" | "keyword" | "string" | "comment" | "number" | "type";
export type SyntaxToken = { text: string; kind: SyntaxKind };
export type Span = { text: string; kind: SyntaxKind; isChanged: boolean };
export type Language = {
  keywords: string[];
  lineComments: string[];
  hasBlockComments?: boolean;
  quotes: string;
  isTypeCapitalized?: boolean;
};
