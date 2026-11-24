import type { Language, Span, SyntaxKind, SyntaxToken } from "./syntax.types";
import type { TextSegment } from "./worddiff.types";

type Compiled = { pattern: RegExp; kinds: SyntaxKind[]; keywords: Set<string> };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const compiled = new WeakMap<Language, Compiled>();

function compile(language: Language): Compiled {
  const cached = compiled.get(language);
  if (cached) return cached;
  const parts: [SyntaxKind, string][] = [
    ...language.lineComments.map((marker): [SyntaxKind, string] => ["comment", `${escape(marker)}.*`]),
    ...(language.hasBlockComments ? [["comment", "\\/\\*.*?(?:\\*\\/|$)"], ["comment", "^\\s*\\*.*"]] as [SyntaxKind, string][] : []),
    ...[...language.quotes].map((quote): [SyntaxKind, string] => ["string", `${escape(quote)}(?:\\\\.|[^${escape(quote)}\\\\])*(?:${escape(quote)}|$)`]),
    ["number", "\\b0x[\\da-fA-F]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?\\b"],
    ["plain", "[A-Za-z_$][\\w$]*"],
  ];
  const result = {
    pattern: new RegExp(parts.map(([, source], index) => `(?<t${index}>${source})`).join("|"), "g"),
    kinds: parts.map(([kind]) => kind),
    keywords: new Set(language.keywords),
  };
  compiled.set(language, result);
  return result;
}

/** Splits one line into coloured pieces. Pieces that carry no colour are `plain`. */
export function tokenize(text: string, language: Language | null): SyntaxToken[] {
  if (!language) return [{ text, kind: "plain" }];
  const { pattern, kinds, keywords } = compile(language);
  const tokens: SyntaxToken[] = [];
  let position = 0;
  const push = (piece: string, kind: SyntaxKind) => {
    if (!piece) return;
    const last = tokens[tokens.length - 1];
    if (last && last.kind === kind) last.text += piece;
    else tokens.push({ text: piece, kind });
  };
  for (const match of text.matchAll(pattern)) {
    push(text.slice(position, match.index), "plain");
    const index = kinds.findIndex((_, number) => match.groups?.[`t${number}`] !== undefined);
    let kind = kinds[index] ?? "plain";
    if (kind === "plain") {
      if (keywords.has(match[0])) kind = "keyword";
      else if (language.isTypeCapitalized && /^[A-Z][a-z]/.test(match[0])) kind = "type";
    }
    push(match[0], kind);
    position = match.index + match[0].length;
  }
  push(text.slice(position), "plain");
  return tokens;
}

/** Layers changed-word markers over syntax colours, so each piece has both. */
export function layerSpans(tokens: SyntaxToken[], words?: TextSegment[]): Span[] {
  if (!words) return tokens.map((token) => ({ ...token, isChanged: false }));
  const spans: Span[] = [];
  let tokenIndex = 0;
  let tokenOffset = 0;
  for (const word of words) {
    let remaining = word.text.length;
    while (remaining > 0 && tokenIndex < tokens.length) {
      const token = tokens[tokenIndex]!;
      const take = Math.min(remaining, token.text.length - tokenOffset);
      spans.push({ text: token.text.slice(tokenOffset, tokenOffset + take), kind: token.kind, isChanged: word.isChanged });
      remaining -= take;
      tokenOffset += take;
      if (tokenOffset >= token.text.length) { tokenIndex += 1; tokenOffset = 0; }
    }
  }
  return spans;
}
