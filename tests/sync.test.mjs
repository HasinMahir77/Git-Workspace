import assert from "node:assert/strict";
import { test } from "node:test";
import { lastFetchedLabel, syncAction } from "../src/git/sync.helpers.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = 1_800_000_000_000;

const status = (overrides = {}) => ({
  branch: "main", upstream: "origin/main", isUnborn: false, hasUpstreamRef: true, ahead: 0, behind: 0, files: [], ...overrides,
});
const sync = (overrides = {}) => ({
  remotes: ["origin"], fetchRemote: "origin", hasConfiguredUpstream: true,
  pushTarget: { remote: "origin", reference: "refs/heads/main" }, pushAhead: 0, ...overrides,
});

test("names the remote in the toolbar title for fetch, pull, and push", () => {
  assert.deepEqual(syncAction(status(), sync()), { kind: "fetch", label: "Fetch", title: "Fetch origin" });
  assert.deepEqual(syncAction(status({ behind: 2 }), sync({ fetchRemote: "upstream" })), { kind: "pull", label: "Pull", title: "Pull upstream" });
  assert.deepEqual(syncAction(status({ ahead: 1 }), sync({ pushAhead: 1, pushTarget: { remote: "fork", reference: "refs/heads/main" } })),
    { kind: "push", label: "Push", title: "Push fork" });
});

test("offers to publish a branch that has never had an upstream", () => {
  assert.deepEqual(syncAction(status({ upstream: null, hasUpstreamRef: false }), sync({ hasConfiguredUpstream: false, pushTarget: null, pushAhead: null })),
    { kind: "publish", label: "Publish branch", title: "Publish branch" });
});

test("has no sync action without a remote", () => {
  assert.equal(syncAction(status(), sync({ remotes: [], fetchRemote: null })), null);
});

test("describes when this session last fetched", () => {
  assert.equal(lastFetchedLabel(undefined, NOW), undefined);
  assert.equal(lastFetchedLabel(NOW - 20_000, NOW), "Last fetched just now");
  assert.equal(lastFetchedLabel(NOW - MINUTE, NOW), "Last fetched 1 minute ago");
  assert.equal(lastFetchedLabel(NOW - 5 * MINUTE, NOW), "Last fetched 5 minutes ago");
  assert.equal(lastFetchedLabel(NOW - 3 * HOUR, NOW), "Last fetched 3 hours ago");
  assert.equal(lastFetchedLabel(NOW - 2 * DAY, NOW), "Last fetched 2 days ago");
});
