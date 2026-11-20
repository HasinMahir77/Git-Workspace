import assert from "node:assert/strict";
import { test } from "node:test";
import { changesListMenu, changesMenu, commitMenu, repositoryMenu } from "../src/git/menu.helpers.ts";

const noop = () => {};
let sequence = 0;
const changedFile = (overrides = {}) => {
  sequence += 1;
  return { id: `file-${sequence}`, path: `src/file-${sequence}.ts`, originalPath: null, staged: ".", unstaged: "M", hasConflict: false, ...overrides };
};
const changesActions = (files, overrides = {}) => ({
  repositoryPath: "/work/app", files, editorLabel: "Visual Studio Code", copy: noop, discard: noop, ignorePath: noop,
  ignorePattern: noop, include: noop, showInFiles: noop, openInEditor: noop, openDefault: noop, ...overrides,
});
const labels = (items) => items.filter((item) => item.type !== "separator").map((item) => item.label);
const find = (items, label) => items.find((item) => item.label === label);

test("a single file offers ignore folder choices from the deepest folder up", () => {
  const items = changesMenu(changesActions([changedFile({ path: "src/ui/panel/view.ts" })]));
  assert.deepEqual(find(items, "Ignore folder (add to .gitignore)").submenu.map((item) => item.label), ["/src/ui/panel", "/src/ui", "/src"]);
  assert.ok(labels(items).includes("Copy file path"));
});

test("several files switch to selection wording and offer include and exclude", () => {
  const files = [changedFile({ path: "a.ts" }), changedFile({ path: "b.css" }), changedFile({ path: "c.ts" })];
  const items = changesMenu(changesActions(files));
  assert.deepEqual(labels(items).slice(0, 2), ["Discard 3 selected changes…", "Ignore 3 selected files (add to .gitignore)"]);
  assert.ok(labels(items).includes("Include selected files"));
  assert.ok(labels(items).includes("Ignore all .ts files (add to .gitignore)"));
  assert.ok(labels(items).includes("Ignore all .css files (add to .gitignore)"));
});

test("copy paths joins absolute and relative paths line by line", () => {
  const copied = [];
  const files = [changedFile({ path: "a.ts" }), changedFile({ path: "dir/b.ts" })];
  const items = changesMenu(changesActions(files, { copy: (text) => copied.push(text) }));
  find(items, "Copy paths").action();
  find(items, "Copy relative paths").action();
  assert.deepEqual(copied, ["/work/app/a.ts\n/work/app/dir/b.ts", "a.ts\ndir/b.ts"]);
});

test("a deleted file cannot be shown, edited or opened, and .gitignore cannot ignore itself", () => {
  const deleted = changesMenu(changesActions([changedFile({ unstaged: "D" })]));
  for (const label of ["Show in your File Manager", "Open in Visual Studio Code", "Open with default program"]) {
    assert.equal(find(deleted, label).isEnabled, false, label);
  }
  const ignoreFile = changesMenu(changesActions([changedFile({ path: ".gitignore" })]));
  assert.equal(find(ignoreFile, "Ignore file (add to .gitignore)").isEnabled, false);
});

test("without an installed editor the editor entry is disabled with the generic label", () => {
  const items = changesMenu(changesActions([changedFile()], { editorLabel: null }));
  assert.equal(find(items, "Open in external editor").isEnabled, false);
});

test("the changes list menu enables discard and stash only when they can run", () => {
  const idle = changesListMenu({ hasChanges: false, canStash: false, discardAll: noop, stashAll: noop });
  assert.deepEqual(idle.map((item) => item.isEnabled), [false, false]);
  const ready = changesListMenu({ hasChanges: true, canStash: true, discardAll: noop, stashAll: noop });
  assert.deepEqual(ready.map((item) => item.isEnabled), [true, true]);
});

test("the current commit cannot be checked out and view on GitHub needs a GitHub remote", () => {
  const base = { id: "abc", isCurrent: true, canCherryPick: false, hasGitHubRemote: false, copy: noop, checkout: noop, revert: noop, createBranch: noop, cherryPick: noop, viewOnGitHub: noop };
  const items = commitMenu(base);
  assert.equal(find(items, "Checkout commit").isEnabled, false);
  assert.equal(find(items, "View on GitHub").isEnabled, false);
  assert.equal(find(items, "Cherry-pick commit…").isEnabled, false);
  const older = commitMenu({ ...base, isCurrent: false, hasGitHubRemote: true, canCherryPick: true });
  assert.equal(find(older, "Checkout commit").isEnabled, true);
  assert.equal(find(older, "View on GitHub").isEnabled, true);
});

test("the repository menu follows GitHub Desktop's order and ends with remove", () => {
  const items = repositoryMenu({
    entry: { id: "1", name: "notes", path: "/work/notes" }, hasGitHubRemote: true, editorLabel: null, copy: noop,
    viewOnGitHub: noop, openInTerminal: noop, showInFiles: noop, openInEditor: noop, remove: noop,
  });
  assert.deepEqual(labels(items), ["Copy repo name", "Copy repo path", "View on GitHub", "Open in Terminal", "Show in your File Manager", "Open in external editor", "Remove…"]);
});
