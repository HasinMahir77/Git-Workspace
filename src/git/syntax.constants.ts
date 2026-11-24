import type { Language } from "./syntax.types";

const C_LIKE = ["if", "else", "for", "while", "do", "switch", "case", "break", "continue", "return", "new", "this", "class", "struct",
  "enum", "static", "const", "void", "int", "long", "char", "bool", "float", "double", "true", "false", "null", "try", "catch", "throw",
  "public", "private", "protected", "import", "package", "namespace", "using", "interface", "extends", "implements", "final", "default"];

export const LANGUAGES: Record<string, Language> = {
  javascript: {
    keywords: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new",
      "this", "class", "extends", "import", "export", "from", "default", "async", "await", "try", "catch", "finally", "throw", "typeof",
      "instanceof", "in", "of", "true", "false", "null", "undefined", "type", "interface", "enum", "readonly", "as", "void", "yield"],
    lineComments: ["//"], hasBlockComments: true, quotes: "\"'`", isTypeCapitalized: true,
  },
  rust: {
    keywords: ["fn", "let", "mut", "pub", "struct", "enum", "impl", "trait", "use", "mod", "match", "if", "else", "for", "while", "loop",
      "return", "break", "continue", "const", "static", "ref", "move", "async", "await", "self", "Self", "super", "crate", "as", "in",
      "where", "true", "false", "type", "unsafe", "dyn"],
    lineComments: ["//"], hasBlockComments: true, quotes: "\"", isTypeCapitalized: true,
  },
  python: {
    keywords: ["def", "class", "return", "if", "elif", "else", "for", "while", "break", "continue", "import", "from", "as", "try", "except",
      "finally", "raise", "with", "lambda", "yield", "pass", "in", "is", "not", "and", "or", "None", "True", "False", "self", "async", "await"],
    lineComments: ["#"], quotes: "\"'", isTypeCapitalized: true,
  },
  go: {
    keywords: ["func", "var", "const", "type", "struct", "interface", "package", "import", "return", "if", "else", "for", "range", "switch",
      "case", "default", "break", "continue", "go", "defer", "chan", "map", "select", "nil", "true", "false"],
    lineComments: ["//"], hasBlockComments: true, quotes: "\"'`", isTypeCapitalized: true,
  },
  clike: { keywords: C_LIKE, lineComments: ["//"], hasBlockComments: true, quotes: "\"'", isTypeCapitalized: true },
  shell: {
    keywords: ["if", "then", "else", "elif", "fi", "for", "do", "done", "while", "case", "esac", "function", "return", "export", "local", "in"],
    lineComments: ["#"], quotes: "\"'",
  },
  ruby: {
    keywords: ["def", "end", "class", "module", "if", "elsif", "else", "unless", "while", "do", "return", "require", "yield", "nil", "true", "false", "self"],
    lineComments: ["#"], quotes: "\"'", isTypeCapitalized: true,
  },
  json: { keywords: ["true", "false", "null"], lineComments: [], quotes: "\"" },
  css: { keywords: ["important", "media", "import", "var", "calc"], lineComments: [], hasBlockComments: true, quotes: "\"'" },
  sql: {
    keywords: ["select", "from", "where", "insert", "into", "update", "delete", "create", "table", "join", "left", "right", "inner", "on", "group",
      "by", "order", "limit", "and", "or", "not", "null", "as", "values", "set", "alter", "drop", "index", "primary", "key", "SELECT", "FROM",
      "WHERE", "INSERT", "INTO", "UPDATE", "DELETE", "CREATE", "TABLE", "JOIN", "ON", "GROUP", "BY", "ORDER", "LIMIT", "AND", "OR", "NOT", "NULL", "AS", "VALUES", "SET"],
    lineComments: ["--"], hasBlockComments: true, quotes: "\"'",
  },
};

export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "javascript", tsx: "javascript", js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  rs: "rust", py: "python", go: "go", c: "clike", h: "clike", cc: "clike", cpp: "clike", hpp: "clike", java: "clike", cs: "clike",
  kt: "clike", swift: "clike", sh: "shell", bash: "shell", zsh: "shell", rb: "ruby", json: "json", css: "css", scss: "css", sql: "sql",
};

export const MAX_HIGHLIGHT_LINE_LENGTH = 1500;
