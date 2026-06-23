import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { processTarget } from "../src/core/targets.js";

function makeTmp() {
  const dir = join(tmpdir(), `pvs-replace-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir);
  return dir;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

const vars = {
  version: "1.4.2",
  major: "1",
  minor: "4",
  patch: "2",
  prerelease: "",
  build: "20260622",
  isoDate: "2026-06-22T00:00:00.000Z",
  date: "2026-06-22",
  gitSha: "",
  gitShaLong: "",
};

test("updates one match", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "README.md");
    writeFileSync(filePath, "Current version: v1.4.1\n");

    const target = {
      file: "README.md",
      type: "replace",
      match: "Current version: v[0-9]+\\.[0-9]+\\.[0-9]+",
      replace: "Current version: v$version",
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    assert.equal(content, "Current version: v1.4.2\n");
  } finally {
    cleanup(dir);
  }
});

test("fails on zero matches", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "README.md");
    writeFileSync(filePath, "No version here\n");

    const target = {
      file: "README.md",
      type: "replace",
      match: "version: [0-9]+",
      replace: "version: $version",
      _resolved: filePath,
    };

    assert.throws(() => processTarget(target, vars), /PVS_TARGET_NO_MATCH|No matches/);
  } finally {
    cleanup(dir);
  }
});

test("fails on multiple matches without multiple flag", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "file.txt");
    writeFileSync(filePath, "v1.0.0 and v1.0.0\n");

    const target = {
      file: "file.txt",
      type: "replace",
      match: "v[0-9]+\\.[0-9]+\\.[0-9]+",
      replace: "v$version",
      _resolved: filePath,
    };

    assert.throws(() => processTarget(target, vars), { code: "PVS_TARGET_MULTI_MATCH" });
  } finally {
    cleanup(dir);
  }
});

test("replaces multiple matches with multiple:true", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "file.txt");
    writeFileSync(filePath, "v1.0.0 and v1.0.0\n");

    const target = {
      file: "file.txt",
      type: "replace",
      match: "v[0-9]+\\.[0-9]+\\.[0-9]+",
      replace: "v$version",
      multiple: true,
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    assert.equal(content, "v1.4.2 and v1.4.2\n");
  } finally {
    cleanup(dir);
  }
});

test("replacement does not misinterpret $ in replacement string", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "file.ts");
    writeFileSync(filePath, 'const V = "1.0.0";\n');

    const target = {
      file: "file.ts",
      type: "replace",
      match: '"[0-9]+\\.[0-9]+\\.[0-9]+"',
      replace: '"$version"',
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    assert.equal(content, 'const V = "1.4.2";\n');
  } finally {
    cleanup(dir);
  }
});

test("fails when regex pattern exceeds 500 chars", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "file.txt");
    writeFileSync(filePath, "some content\n");

    const target = {
      file: "file.txt",
      type: "replace",
      match: "a".repeat(501),
      replace: "x",
      _resolved: filePath,
    };

    assert.throws(() => processTarget(target, vars), /PVS_CONFIG_INVALID|too long/);
  } finally {
    cleanup(dir);
  }
});

test("fails on invalid regex", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "file.txt");
    writeFileSync(filePath, "some content\n");

    const target = {
      file: "file.txt",
      type: "replace",
      match: "[invalid",
      replace: "x",
      _resolved: filePath,
    };

    assert.throws(() => processTarget(target, vars), /PVS_CONFIG_INVALID|Invalid regex/);
  } finally {
    cleanup(dir);
  }
});
