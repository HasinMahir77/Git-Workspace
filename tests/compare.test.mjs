import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultCompareTarget, mergeBaseLabel } from "../src/git/compare.helpers.ts";

const groups = { local: ["main", "feature"], remote: ["origin/main"] };

test("defaults the second branch to the upstream when it resolves", () => {
  assert.equal(defaultCompareTarget("origin/main", groups, "main"), "origin/main");
});

test("prompts for a branch when the upstream is missing, gone, or the current branch", () => {
  assert.equal(defaultCompareTarget(null, groups, "main"), null);
  assert.equal(defaultCompareTarget("origin/gone", groups, "main"), null);
  assert.equal(defaultCompareTarget("main", groups, "main"), null);
});

test("labels an unavailable merge base", () => {
  assert.equal(mergeBaseLabel(null), "No merge base");
  assert.equal(mergeBaseLabel("0123456789abcdef"), "Merge base 01234567");
});
