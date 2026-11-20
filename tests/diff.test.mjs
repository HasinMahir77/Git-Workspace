import assert from "node:assert/strict";
import { test } from "node:test";
import { splitDiff } from "../src/git/diff.helpers.ts";

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
