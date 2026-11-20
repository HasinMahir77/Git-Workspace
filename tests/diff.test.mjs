import assert from "node:assert/strict";
import { test } from "node:test";
import { splitDiff, unifiedDiff } from "../src/git/diff.helpers.ts";

test("aligns removed and added lines without losing their original line numbers", () => {
  const patch = [
    "@@ -4,4 +4,3 @@",
    " context",
    "-first removal",
    "-second removal",
    "+replacement",
    " final",
  ].join("\n");

  assert.deepEqual(splitDiff(patch).slice(1), [
    { left: { number: 4, text: "context", kind: "context" }, right: { number: 4, text: "context", kind: "context" } },
    { left: { number: 5, text: "first removal", kind: "deletion" }, right: { number: 5, text: "replacement", kind: "addition" } },
    { left: { number: 6, text: "second removal", kind: "deletion" }, right: null },
    { left: { number: 7, text: "final", kind: "context" }, right: { number: 6, text: "final", kind: "context" } },
  ]);
});

test("numbers unified rows from both sides and keeps hunk positions", () => {
  const patch = [
    "diff --git a/a.txt b/a.txt",
    "index 111..222 100644",
    "--- a/a.txt",
    "+++ b/a.txt",
    "@@ -2,2 +2,2 @@",
    " keep",
    "--- starts with dashes",
    "+added",
    "@@ -9 +9 @@",
    "-old",
    "\\ No newline at end of file",
  ].join("\n");

  assert.deepEqual(unifiedDiff(patch, false), [
    { kind: "hunk", text: "@@ -2,2 +2,2 @@", hunkIndex: 0 },
    { kind: "context", text: "keep", oldNumber: 2, newNumber: 2 },
    { kind: "deletion", text: "-- starts with dashes", oldNumber: 3, newNumber: null },
    { kind: "addition", text: "added", oldNumber: null, newNumber: 3 },
    { kind: "hunk", text: "@@ -9 +9 @@", hunkIndex: 1 },
    { kind: "deletion", text: "old", oldNumber: 9, newNumber: null },
    { kind: "note", text: "\\ No newline at end of file" },
  ]);
  assert.equal(unifiedDiff(patch, true)[0].kind, "file");
});
