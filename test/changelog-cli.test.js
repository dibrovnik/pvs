import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = resolve(__dirname, "../bin/pvs.js");

function makeTmp() {
  const dir = join(tmpdir(), `pvs-changelog-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir);
  return dir;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function git(args, cwd) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  }
  return r.stdout;
}

function pvs(args, cwd) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });
  return { stdout: r.stdout || "", stderr: r.stderr || "", status: r.status };
}

function initRepo(dir, version) {
  git(["init", "-q"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "test-pkg", version }, null, 2) + "\n");
  git(["add", "-A"], dir);
  git(["commit", "-q", "-m", "chore: init"], dir);
}

test("pvs changelog writes grouped entries since the last tag", () => {
  const dir = makeTmp();
  try {
    initRepo(dir, "1.0.0");
    git(["tag", "v1.0.0"], dir);

    writeFileSync(join(dir, "a.txt"), "a");
    git(["add", "-A"], dir);
    git(["commit", "-q", "-m", "feat(cli): add changelog command"], dir);

    writeFileSync(join(dir, "b.txt"), "b");
    git(["add", "-A"], dir);
    git(["commit", "-q", "-m", "fix: correct off-by-one"], dir);

    writeFileSync(join(dir, "c.txt"), "c");
    git(["add", "-A"], dir);
    git(["commit", "-q", "-m", "docs: typo"], dir);

    const r = pvs(["changelog"], dir);
    assert.equal(r.status, 0);

    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
    assert.ok(content.startsWith("# Changelog"));
    assert.ok(content.includes("### Features"));
    assert.ok(content.includes("add changelog command"));
    assert.ok(content.includes("### Bug Fixes"));
    assert.ok(content.includes("correct off-by-one"));
    assert.ok(!content.includes("typo")); // docs: is excluded by default
  } finally {
    cleanup(dir);
  }
});

test("pvs changelog fails clearly when there are no relevant commits", () => {
  const dir = makeTmp();
  try {
    initRepo(dir, "1.0.0");
    git(["tag", "v1.0.0"], dir);

    writeFileSync(join(dir, "a.txt"), "a");
    git(["add", "-A"], dir);
    git(["commit", "-q", "-m", "chore: bump deps"], dir);

    const r = pvs(["changelog"], dir);
    assert.notEqual(r.status, 0);
    assert.ok(r.stderr.toLowerCase().includes("no feat/fix"));
  } finally {
    cleanup(dir);
  }
});

test("pvs bump auto picks minor when a feat commit is present", () => {
  const dir = makeTmp();
  try {
    initRepo(dir, "1.0.0");
    git(["tag", "v1.0.0"], dir);

    writeFileSync(join(dir, "a.txt"), "a");
    git(["add", "-A"], dir);
    git(["commit", "-q", "-m", "feat: add new option"], dir);

    const r = pvs(["bump", "auto"], dir);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes("1.0.0 -> 1.1.0"));
  } finally {
    cleanup(dir);
  }
});

test("pvs bump auto picks major when a commit is breaking", () => {
  const dir = makeTmp();
  try {
    initRepo(dir, "1.0.0");
    git(["tag", "v1.0.0"], dir);

    writeFileSync(join(dir, "a.txt"), "a");
    git(["add", "-A"], dir);
    git(["commit", "-q", "-m", "feat!: drop old API"], dir);

    const r = pvs(["bump", "auto"], dir);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes("1.0.0 -> 2.0.0"));
  } finally {
    cleanup(dir);
  }
});

test("pvs bump --changelog writes CHANGELOG.md alongside the version bump", () => {
  const dir = makeTmp();
  try {
    initRepo(dir, "1.0.0");
    git(["tag", "v1.0.0"], dir);

    writeFileSync(join(dir, "a.txt"), "a");
    git(["add", "-A"], dir);
    git(["commit", "-q", "-m", "fix: patch a bug"], dir);

    const r = pvs(["bump", "patch", "--changelog"], dir);
    assert.equal(r.status, 0);
    assert.ok(r.stdout.includes("CHANGELOG.md"));

    const content = readFileSync(join(dir, "CHANGELOG.md"), "utf8");
    assert.ok(content.includes("## 1.0.1"));
    assert.ok(content.includes("patch a bug"));
  } finally {
    cleanup(dir);
  }
});
