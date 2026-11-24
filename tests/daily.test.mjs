import assert from "node:assert/strict";
import { test } from "node:test";
import { commitAge, commitDateTitle } from "../src/git/date.helpers.ts";
import { wordSegments, unifiedWordSegments, splitWordSegments } from "../src/git/worddiff.helpers.ts";
import { layerSpans, tokenize } from "../src/git/syntax.helpers.ts";
import { commitMessageIssue, messageTemplate, ticketFromBranch, usesConventionalCommits } from "../src/git/commit-message.helpers.ts";
import { filterByPath } from "../src/git/file-filter.helpers.ts";
import { isDefaultDiffOptions, readDiffOptions } from "../src/git/diff-view.helpers.ts";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const HOUR = 3_600_000;
const iso = (ago) => new Date(NOW - ago).toISOString();

const javascript = { keywords: ["const", "return", "if"], lineComments: ["//"], hasBlockComments: true, quotes: "\"'`", isTypeCapitalized: true };
const python = { keywords: ["def", "return"], lineComments: ["#"], quotes: "\"'" };
const line = (kind, text, extra = {}) => ({ kind, text, oldNumber: 1, newNumber: 1, hunkLine: 0, ...extra });
const file = (path) => ({ path });

test("commit ages read as relative time", () => {
  assert.equal(commitAge(iso(10_000), NOW), "just now");
  assert.equal(commitAge(iso(3 * HOUR), NOW), "3 hours ago");
  assert.equal(commitAge(iso(24 * HOUR), NOW), "1 day ago");
  assert.equal(commitAge(iso(21 * 24 * HOUR), NOW), "3 weeks ago");
  assert.equal(commitAge(iso(400 * 24 * HOUR), NOW), "1 year ago");
  assert.equal(commitAge("not a date", NOW), "not a date");
  assert.equal(commitAge(iso(-HOUR), NOW), "just now");
});

test("the hover title shows the exact date", () => {
  assert.match(commitDateTitle("2026-11-20T12:00:00Z"), /2026/);
  assert.equal(commitDateTitle("junk"), "junk");
});

test("word diffs mark only the words that changed", () => {
  const { before, after } = wordSegments("const total = price * 2;", "const total = price * 3;");
  assert.deepEqual(before.filter((part) => part.isChanged).map((part) => part.text), ["2"]);
  assert.deepEqual(after.filter((part) => part.isChanged).map((part) => part.text), ["3"]);
  assert.equal(before.map((part) => part.text).join(""), "const total = price * 2;");
});

test("word diffs are skipped when the lines share nothing", () => {
  assert.equal(wordSegments("alpha", "omega"), null);
});

test("unified rows pair deletions with additions in order", () => {
  const rows = [
    { kind: "hunk", text: "@@", hunkIndex: 0 },
    line("deletion", "let a = 1;"), line("deletion", "let b = 2;"),
    line("addition", "let a = 10;"), line("addition", "let b = 20;"),
    line("context", "done"),
  ];
  const marks = unifiedWordSegments(rows);
  assert.deepEqual([...marks.keys()].sort(), [1, 2, 3, 4]);
  assert.equal(marks.get(3).find((part) => part.isChanged).text, "10");
});

test("an unpaired extra addition gets no word marks", () => {
  const rows = [line("deletion", "x = 1"), line("addition", "x = 2"), line("addition", "y = 3")];
  assert.deepEqual([...unifiedWordSegments(rows).keys()], [0, 1]);
});

test("split rows pair the two sides of one row", () => {
  const rows = [{ left: { text: "a = 1", kind: "deletion" }, right: { text: "a = 2", kind: "addition" } }, { meta: "@@" },
    { left: { text: "same", kind: "context" }, right: { text: "same", kind: "context" } }];
  assert.deepEqual([...splitWordSegments(rows).keys()], [0]);
});

test("tokenizer colours keywords, strings, numbers, comments, and types", () => {
  const tokens = tokenize('const name = "Ada"; // hi', javascript);
  assert.deepEqual(tokens.filter((token) => token.kind !== "plain").map((token) => [token.kind, token.text]),
    [["keyword", "const"], ["string", '"Ada"'], ["comment", "// hi"]]);
  assert.deepEqual(tokenize("return Widget(42)", javascript).filter((token) => token.kind !== "plain").map((token) => token.kind),
    ["keyword", "type", "number"]);
});

test("tokens always reassemble to the original line", () => {
  for (const text of ['if (a) { return "x\\"y"; }', "/* open", " * continued", "`tpl ${a}`", "0x1F + 3.5e2", ""]) {
    assert.equal(tokenize(text, javascript).map((token) => token.text).join(""), text);
  }
});

test("a language without block comments leaves slashes alone", () => {
  assert.deepEqual(tokenize("x = a / b  # note", python).map((token) => token.kind), ["plain", "comment"]);
});

test("unknown languages stay plain", () => {
  assert.deepEqual(tokenize("anything goes", null), [{ text: "anything goes", kind: "plain" }]);
});

test("word marks layer over syntax colours without losing text", () => {
  const tokens = tokenize("const a = 1;", javascript);
  const spans = layerSpans(tokens, [{ text: "const a = ", isChanged: false }, { text: "1", isChanged: true }, { text: ";", isChanged: false }]);
  assert.equal(spans.map((span) => span.text).join(""), "const a = 1;");
  assert.deepEqual(spans.find((span) => span.isChanged), { text: "1", kind: "number", isChanged: true });
  assert.equal(spans[0].kind, "keyword");
});

test("tickets and templates come from the branch name", () => {
  assert.equal(ticketFromBranch("fix/gh-123-login"), "GH-123");
  assert.equal(ticketFromBranch("main"), null);
  assert.equal(messageTemplate("fix/GH-123-login"), "fix(GH-123): ");
  assert.equal(messageTemplate("feature/GH-9"), "feat(GH-9): ");
  assert.equal(messageTemplate("main"), null);
});

test("summaries are checked against the conventional format", () => {
  assert.equal(commitMessageIssue(""), null);
  assert.equal(commitMessageIssue("feat(GH-12): add login"), null);
  assert.equal(commitMessageIssue("fix: small thing"), null);
  assert.match(commitMessageIssue("added login"), /type\(TICKET-123\)/);
  assert.match(commitMessageIssue(`feat(GH-1): ${"x".repeat(100)}`), /100 characters/);
});

test("the convention is detected from recent history", () => {
  assert.equal(usesConventionalCommits(["feat(A-1): a", "fix(A-2): b", "chore(A-3): c", "wip"]), true);
  assert.equal(usesConventionalCommits(["wip", "more", "stuff", "feat: one"]), false);
  assert.equal(usesConventionalCommits(["feat: a", "fix: b"]), false);
});

test("the file filter matches every word anywhere in the path", () => {
  const files = [file("src/App.tsx"), file("src/git/diff.helpers.ts"), file("README.md")];
  assert.deepEqual(filterByPath(files, "git diff"), [files[1]]);
  assert.deepEqual(filterByPath(files, "APP"), [files[0]]);
  assert.deepEqual(filterByPath(files, "  "), files);
});

test("diff options read safely from storage", () => {
  assert.deepEqual(readDiffOptions('{"shouldIgnoreWhitespace":true,"contextLines":10}'), { shouldIgnoreWhitespace: true, contextLines: 10 });
  assert.deepEqual(readDiffOptions("garbage"), { shouldIgnoreWhitespace: false, contextLines: null });
  assert.deepEqual(readDiffOptions('{"contextLines":-4}'), { shouldIgnoreWhitespace: false, contextLines: null });
  assert.equal(isDefaultDiffOptions({ shouldIgnoreWhitespace: false, contextLines: null }), true);
  assert.equal(isDefaultDiffOptions({ shouldIgnoreWhitespace: true, contextLines: null }), false);
  assert.equal(isDefaultDiffOptions({ shouldIgnoreWhitespace: false, contextLines: 10 }), false);
});

const pullRequest = (overrides = {}) => ({ number: 12, title: "Add thing", state: "OPEN", url: "https://github.com/o/r/pull/12", isDraft: false, checks: "none", ...overrides });

test("pull request subtitles combine state and checks", async () => {
  const { pullRequestDescription, canCreatePullRequest } = await import("../src/git/pull-request.helpers.ts");
  assert.equal(pullRequestDescription(pullRequest()), "Open");
  assert.equal(pullRequestDescription(pullRequest({ checks: "failing" })), "Open, checks failing");
  assert.equal(pullRequestDescription(pullRequest({ isDraft: true, checks: "pending" })), "Draft, checks running");
  assert.equal(pullRequestDescription(pullRequest({ state: "MERGED", checks: "passing" })), "Merged");
  assert.equal(canCreatePullRequest("feat/x", true), true);
  assert.equal(canCreatePullRequest("main", true), false);
  assert.equal(canCreatePullRequest("feat/x", false), false);
  assert.equal(canCreatePullRequest(null, true), false);
});

const noop = () => {};
const menuActions = (overrides = {}) => ({
  hasRepository: true, isBusy: false, hasGitHubRemote: true, editorLabel: "Visual Studio Code", syncTitle: "Fetch origin",
  newRepository: noop, addRepository: noop, cloneRepository: noop, openSettings: noop, openAccounts: noop, switchRepository: noop, refresh: noop,
  openTerminal: noop, showInFiles: noop, openInEditor: noop, viewOnGitHub: noop, openBranches: noop, compareBranches: noop, sync: noop, ...overrides,
});
const entry = (menus, menu, label) => menus.find((candidate) => candidate.label === menu).items.find((item) => item.label === label);

test("the app menu bar has File, Repository, and Branch menus", async () => {
  const { appMenus } = await import("../src/git/app-menu.helpers.ts");
  const menus = appMenus(menuActions());
  assert.deepEqual(menus.map((menu) => menu.label), ["File", "Repository", "Branch"]);
  assert.equal(entry(menus, "File", "Options…").shortcut, "Ctrl+,");
  assert.equal(entry(menus, "Repository", "Open in Visual Studio Code").isEnabled, true);
  assert.equal(entry(menus, "Branch", "Fetch origin").isEnabled, true);
});

test("repository menu items are off without a repository, and write actions are off while busy", async () => {
  const { appMenus } = await import("../src/git/app-menu.helpers.ts");
  const none = appMenus(menuActions({ hasRepository: false, syncTitle: null }));
  assert.equal(entry(none, "Repository", "Refresh").isEnabled, false);
  assert.equal(entry(none, "Branch", "Fetch").isEnabled, false);
  assert.equal(entry(none, "File", "Options…").isEnabled, undefined);
  const busy = appMenus(menuActions({ isBusy: true, editorLabel: null, hasGitHubRemote: false }));
  assert.equal(entry(busy, "File", "New repository…").isEnabled, false);
  assert.equal(entry(busy, "Repository", "Open in external editor").isEnabled, false);
  assert.equal(entry(busy, "Repository", "View on GitHub").isEnabled, false);
  assert.equal(entry(busy, "Repository", "Open in Terminal").isEnabled, true);
});
