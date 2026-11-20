import assert from "node:assert/strict";
import { test } from "node:test";
import { canContinueRecovery, mergeSummary } from "../src/git/recovery.helpers.ts";

test("names both branches before a merge runs", () => {
  assert.equal(mergeSummary("origin/feature", "development"), "Merge origin/feature into development");
});

test("keeps Continue disabled while unmerged entries remain or an operation runs", () => {
  assert.equal(canContinueRecovery(2, false), false);
  assert.equal(canContinueRecovery(0, true), false);
  assert.equal(canContinueRecovery(0, false), true);
});

import { cherryPickSummary, localNameFor, rebaseSummary } from "../src/git/recovery.helpers.ts";

test("warns that a rebase changes commit IDs and may skip equivalent commits", () => {
  assert.match(rebaseSummary("main", "origin/main", 2), /Rebase main onto origin\/main.*2 local commits.*Commit IDs change/);
  assert.match(rebaseSummary("main", "origin/main", 1), /1 local commit\b/);
});

test("shows the short ID, subject, and destination before a cherry-pick", () => {
  assert.equal(cherryPickSummary("abc12345", "Fix bug", "release"), 'Cherry-pick abc12345 "Fix bug" into release');
});

test("derives the local branch name a remote checkout will create", () => {
  assert.equal(localNameFor("origin/feature/login"), "feature/login");
});
