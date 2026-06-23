import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { processTarget } from "../src/core/targets.js";

function makeTmp() {
  const dir = join(tmpdir(), `pvs-json-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

test("updates top-level key", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "version.json");
    writeFileSync(filePath, JSON.stringify({ version: "1.0.0" }, null, 2) + "\n");

    const target = {
      file: "version.json",
      type: "json",
      values: { version: "$version" },
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    const parsed = JSON.parse(content);
    assert.equal(parsed.version, "1.4.2");
  } finally {
    cleanup(dir);
  }
});

test("updates nested value via dot-path", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "build.json");
    writeFileSync(
      filePath,
      JSON.stringify({ build: { version: "0.0.0", iso: "" } }, null, 2) + "\n"
    );

    const target = {
      file: "build.json",
      type: "json",
      values: { "build.version": "$version", "build.iso": "$isoDate" },
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    const parsed = JSON.parse(content);
    assert.equal(parsed.build.version, "1.4.2");
    assert.equal(parsed.build.iso, "2026-06-22T00:00:00.000Z");
  } finally {
    cleanup(dir);
  }
});

test("preserves 2-space indentation", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "a.json");
    writeFileSync(filePath, '{\n  "version": "1.0.0"\n}\n');

    const target = {
      file: "a.json",
      type: "json",
      values: { version: "$version" },
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    assert.ok(content.startsWith('{\n  "version"'));
  } finally {
    cleanup(dir);
  }
});

test("preserves 4-space indentation", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "a.json");
    writeFileSync(filePath, '{\n    "version": "1.0.0"\n}\n');

    const target = {
      file: "a.json",
      type: "json",
      values: { version: "$version" },
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    assert.ok(content.startsWith('{\n    "version"'));
  } finally {
    cleanup(dir);
  }
});

test("preserves trailing newline", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "a.json");
    writeFileSync(filePath, '{"version":"1.0.0"}\n');

    const target = {
      file: "a.json",
      type: "json",
      values: { version: "$version" },
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    assert.ok(content.endsWith("\n"));
  } finally {
    cleanup(dir);
  }
});

test("no trailing newline when original had none", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "a.json");
    writeFileSync(filePath, '{"version":"1.0.0"}');

    const target = {
      file: "a.json",
      type: "json",
      values: { version: "$version" },
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    assert.ok(!content.endsWith("\n"));
  } finally {
    cleanup(dir);
  }
});

test("fails on invalid JSON", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "bad.json");
    writeFileSync(filePath, "{ not valid json }");

    const target = {
      file: "bad.json",
      type: "json",
      values: { version: "$version" },
      _resolved: filePath,
    };

    assert.throws(() => processTarget(target, vars), /PVS_CONFIG_INVALID|Invalid JSON/);
  } finally {
    cleanup(dir);
  }
});
