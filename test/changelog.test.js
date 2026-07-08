import { test } from "node:test";
import assert from "node:assert/strict";
import { groupCommits, renderChangelogSection, prependChangelog } from "../src/core/changelog.js";
import { parseConventionalCommit } from "../src/core/commits.js";

function commit(hash, subject, body = "") {
  return parseConventionalCommit(hash, subject, body);
}

test("groupCommits buckets by conventional type and drops empty sections", () => {
  const commits = [
    commit("1111111", "feat: add export command"),
    commit("2222222", "fix: correct off-by-one in bump"),
    commit("3333333", "docs: update README"),
  ];
  const grouped = groupCommits(commits);

  assert.equal(grouped.sections.length, 2);
  assert.equal(grouped.sections[0].title, "Features");
  assert.equal(grouped.sections[1].title, "Bug Fixes");
  assert.equal(grouped.breaking.length, 0);
});

test("groupCommits collects breaking commits separately", () => {
  const commits = [
    commit("1111111", "feat!: remove legacy config format"),
    commit("2222222", "fix: minor tweak"),
  ];
  const grouped = groupCommits(commits);

  assert.equal(grouped.breaking.length, 1);
  assert.equal(grouped.breaking[0].hash, "1111111");
});

test("renderChangelogSection produces Keep-a-Changelog style markdown", () => {
  const commits = [commit("abcdef1234567", "feat(cli): add changelog command")];
  const grouped = groupCommits(commits);
  const section = renderChangelogSection("1.1.0", "2026-07-08", grouped);

  assert.ok(section.startsWith("## 1.1.0 (2026-07-08)\n"));
  assert.ok(section.includes("### Features"));
  assert.ok(section.includes("- **cli:** add changelog command (abcdef1)"));
});

test("renderChangelogSection lists BREAKING CHANGES section first", () => {
  const commits = [commit("1111111", "feat!: drop node 18 support")];
  const grouped = groupCommits(commits);
  const section = renderChangelogSection("2.0.0", "2026-07-08", grouped);

  const breakingIdx = section.indexOf("### BREAKING CHANGES");
  const featuresIdx = section.indexOf("### Features");
  assert.ok(breakingIdx !== -1);
  assert.ok(breakingIdx < featuresIdx);
});

test("prependChangelog creates a new file with header when none exists", () => {
  const section = "## 1.0.0 (2026-07-08)\n\n### Features\n\n- initial release (abc1234)\n";
  const result = prependChangelog("", section);

  assert.ok(result.startsWith("# Changelog\n"));
  assert.ok(result.includes("## 1.0.0 (2026-07-08)"));
});

test("prependChangelog inserts new entry above existing entries", () => {
  const existing =
    "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n## 1.0.0 (2026-06-01)\n\n### Features\n\n- initial release (aaa1111)\n";
  const section = "## 1.1.0 (2026-07-08)\n\n### Bug Fixes\n\n- fix crash (bbb2222)\n";
  const result = prependChangelog(existing, section);

  const newIdx = result.indexOf("## 1.1.0");
  const oldIdx = result.indexOf("## 1.0.0");
  assert.ok(newIdx !== -1 && oldIdx !== -1);
  assert.ok(newIdx < oldIdx);
  assert.ok(result.includes("initial release")); // old entry preserved
});
