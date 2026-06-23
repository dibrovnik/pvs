import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { processTarget } from "../src/core/targets.js";

function makeTmp() {
  const dir = join(tmpdir(), `pvs-marker-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

test("updates marker block content", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "version.ts");
    writeFileSync(
      filePath,
      [
        '// pvs:start app-version',
        'export const APP_VERSION = "1.4.1";',
        '// pvs:end app-version',
      ].join("\n") + "\n"
    );

    const target = {
      file: "version.ts",
      type: "marker",
      id: "app-version",
      template: 'export const APP_VERSION = "$version";',
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    assert.ok(content.includes('export const APP_VERSION = "1.4.2";'));
    assert.ok(content.includes("// pvs:start app-version"));
    assert.ok(content.includes("// pvs:end app-version"));
  } finally {
    cleanup(dir);
  }
});

test("preserves markers after update", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "version.ts");
    const original = "// pvs:start my-id\nold content\n// pvs:end my-id\n";
    writeFileSync(filePath, original);

    const target = {
      file: "version.ts",
      type: "marker",
      id: "my-id",
      template: "new content",
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    assert.ok(content.startsWith("// pvs:start my-id\n"));
    assert.ok(content.includes("// pvs:end my-id"));
    assert.ok(content.includes("new content"));
    assert.ok(!content.includes("old content"));
  } finally {
    cleanup(dir);
  }
});

test("fails on missing marker block", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "version.ts");
    writeFileSync(filePath, 'export const V = "1.0.0";\n');

    const target = {
      file: "version.ts",
      type: "marker",
      id: "nonexistent",
      template: "new",
      _resolved: filePath,
    };

    assert.throws(() => processTarget(target, vars), /PVS_TARGET_NO_MATCH|No marker block/);
  } finally {
    cleanup(dir);
  }
});

test("fails on duplicate marker without multiple flag", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "version.ts");
    writeFileSync(
      filePath,
      "// pvs:start dup\nfirst\n// pvs:end dup\n// pvs:start dup\nsecond\n// pvs:end dup\n"
    );

    const target = {
      file: "version.ts",
      type: "marker",
      id: "dup",
      template: "x",
      _resolved: filePath,
    };

    assert.throws(() => processTarget(target, vars), /PVS_TARGET_MULTI_MATCH|Multiple marker/);
  } finally {
    cleanup(dir);
  }
});

test("rejects symlink by default", () => {
  const dir = makeTmp();
  try {
    const realFile = join(dir, "real.ts");
    const linkFile = join(dir, "link.ts");
    writeFileSync(realFile, "// pvs:start v\nold\n// pvs:end v\n");
    // create a symlink pointing to the real file
    void 0; // symlinkSync imported at top
    symlinkSync(realFile, linkFile);

    const target = {
      file: "link.ts",
      type: "marker",
      id: "v",
      template: "new",
      _resolved: linkFile,
    };

    assert.throws(() => processTarget(target, vars, {}), { code: "PVS_UNSAFE_PATH" });
  } finally {
    cleanup(dir);
  }
});

test("allows symlink when allowSymlinks:true", () => {
  const dir = makeTmp();
  try {
    const realFile = join(dir, "real.ts");
    const linkFile = join(dir, "link.ts");
    writeFileSync(realFile, "// pvs:start v\nold\n// pvs:end v\n");
    void 0; // symlinkSync imported at top
    symlinkSync(realFile, linkFile);

    const target = {
      file: "link.ts",
      type: "marker",
      id: "v",
      template: "$version",
      _resolved: linkFile,
    };

    const { content } = processTarget(target, vars, { _allowSymlinks: true });
    assert.ok(content.includes("1.4.2"));
  } finally {
    cleanup(dir);
  }
});

test("allows duplicate markers with multiple:true", () => {
  const dir = makeTmp();
  try {
    const filePath = join(dir, "version.ts");
    writeFileSync(
      filePath,
      "// pvs:start dup\nfirst\n// pvs:end dup\n// pvs:start dup\nsecond\n// pvs:end dup\n"
    );

    const target = {
      file: "version.ts",
      type: "marker",
      id: "dup",
      template: "$version",
      multiple: true,
      _resolved: filePath,
    };

    const { content } = processTarget(target, vars);
    assert.equal((content.match(/1\.4\.2/g) || []).length, 2);
  } finally {
    cleanup(dir);
  }
});
