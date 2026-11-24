export type TextSegment = { text: string; isChanged: boolean };
export type WordPair = { before: TextSegment[]; after: TextSegment[] };
