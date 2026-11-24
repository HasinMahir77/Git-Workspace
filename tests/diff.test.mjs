import assert from "node:assert/strict";
import { test } from "node:test";
import { changedLinesBetween, lineNumberWidth, splitDiff, unifiedDiff } from "../src/git/diff.helpers.ts";

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
    { left: { number: 4, text: "context", kind: "context", hunkLine: 0 }, right: { number: 4, text: "context", kind: "context", hunkLine: 0 } },
    { left: { number: 5, text: "first removal", kind: "deletion", hunkLine: 1 }, right: { number: 5, text: "replacement", kind: "addition", hunkLine: 3 } },
    { left: { number: 6, text: "second removal", kind: "deletion", hunkLine: 2 }, right: null },
    { left: { number: 7, text: "final", kind: "context", hunkLine: 4 }, right: { number: 6, text: "final", kind: "context", hunkLine: 4 } },
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
    { kind: "context", text: "keep", oldNumber: 2, newNumber: 2, hunkLine: 0 },
    { kind: "deletion", text: "-- starts with dashes", oldNumber: 3, newNumber: null, hunkLine: 1 },
    { kind: "addition", text: "added", oldNumber: null, newNumber: 3, hunkLine: 2 },
    { kind: "hunk", text: "@@ -9 +9 @@", hunkIndex: 1 },
    { kind: "deletion", text: "old", oldNumber: 9, newNumber: null, hunkLine: 0 },
    { kind: "note", text: "\\ No newline at end of file" },
  ]);
  assert.equal(unifiedDiff(patch, true)[0].kind, "file");
});

test("sizes each line number column like GitHub Desktop, with room for at least three digits", () => {
  assert.equal(lineNumberWidth(7), 35);
  assert.equal(lineNumberWidth(999), 35);
  assert.equal(lineNumberWidth(12_345), 55);
});

test("numbers each line by its position below the hunk header, counting missing-newline notes", () => {
  const patch = ["@@ -1,2 +1,2 @@", " keep", "-old", "\\ No newline at end of file", "+new", "@@ -9 +9 @@", "-gone"].join("\n");

  const unified = unifiedDiff(patch, false).filter((row) => "oldNumber" in row).map((row) => [row.text, row.hunkLine]);
  const split = splitDiff(patch).flatMap((row) => "meta" in row ? [] : [row.left, row.right]).filter(Boolean).map((line) => [line.text, line.hunkLine]);

  assert.deepEqual(unified, [["keep", 0], ["old", 1], ["new", 3], ["gone", 0]]);
  assert.deepEqual(split, [["keep", 0], ["keep", 0], ["old", 1], ["new", 3], ["gone", 0]]);
});

test("a drag across the line numbers covers only the changed lines of its own hunk, in either direction", () => {
  const rows = unifiedDiff(["@@ -1,4 +1,4 @@", " keep", "-old", "+new", " keep", "+more", "@@ -20 +20 @@", "-later"].join("\n"), false);

  assert.deepEqual(changedLinesBetween(rows, 0, 4, 1), [1, 2, 4]);
  assert.deepEqual(changedLinesBetween(rows, 0, 2, 2), [2]);
  assert.deepEqual(changedLinesBetween(rows, 1, 0, 0), [0]);
});
