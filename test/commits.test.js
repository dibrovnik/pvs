import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConventionalCommit, resolveBumpType } from "../src/core/commits.js";

test("parses a plain feat commit", () => {
  const c = parseConventionalCommit("abc1234", "feat: add login page");
  assert.equal(c.type, "feat");
  assert.equal(c.scope, "");
  assert.equal(c.breaking, false);
  assert.equal(c.subject, "add login page");
});

test("parses scope and fix type", () => {
  const c = parseConventionalCommit("abc1234", "fix(auth): handle expired token");
  assert.equal(c.type, "fix");
  assert.equal(c.scope, "auth");
  assert.equal(c.subject, "handle expired token");
});

test("detects breaking change via ! marker", () => {
  const c = parseConventionalCommit("abc1234", "feat(api)!: drop v1 endpoints");
  assert.equal(c.breaking, true);
  assert.equal(c.type, "feat");
  assert.equal(c.scope, "api");
});

test("detects breaking change via footer", () => {
  const c = parseConventionalCommit(
    "abc1234",
    "feat: rework config format",
    "BREAKING CHANGE: pvs.config.json schemaVersion 2 required"
  );
  assert.equal(c.breaking, true);
  assert.equal(c.breakingNote, "pvs.config.json schemaVersion 2 required");
});

test("falls back to type 'other' for non-conventional subjects", () => {
  const c = parseConventionalCommit("abc1234", "update readme typo");
  assert.equal(c.type, "other");
  assert.equal(c.subject, "update readme typo");
  assert.equal(c.breaking, false);
});

test("resolveBumpType returns major when any commit is breaking", () => {
  const commits = [
    { type: "fix", breaking: false },
    { type: "feat", breaking: true },
  ];
  assert.equal(resolveBumpType(commits), "major");
});

test("resolveBumpType returns minor when there is a feat but no breaking", () => {
  const commits = [
    { type: "fix", breaking: false },
    { type: "feat", breaking: false },
  ];
  assert.equal(resolveBumpType(commits), "minor");
});

test("resolveBumpType returns patch otherwise", () => {
  const commits = [
    { type: "fix", breaking: false },
    { type: "chore", breaking: false },
  ];
  assert.equal(resolveBumpType(commits), "patch");
});

test("resolveBumpType returns patch for empty commit list", () => {
  assert.equal(resolveBumpType([]), "patch");
});
