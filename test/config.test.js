import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/core/config.js";

function makeTmp() {
  const dir = join(tmpdir(), `pvs-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir);
  return dir;
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

test("returns empty targets when no config file exists", () => {
  const dir = makeTmp();
  try {
    const config = loadConfig(dir);
    assert.deepEqual(config.targets, []);
    assert.equal(config._loaded, false);
  } finally {
    cleanup(dir);
  }
});

test("loads valid pvs.config.json", () => {
  const dir = makeTmp();
  try {
    writeFileSync(
      join(dir, "pvs.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        targets: [
          { file: "src/version.ts", type: "generated", template: "export const V = \"$version\";\n" },
        ],
      })
    );
    const config = loadConfig(dir);
    assert.equal(config._loaded, true);
    assert.equal(config.targets.length, 1);
    assert.equal(config.targets[0].file, "src/version.ts");
  } finally {
    cleanup(dir);
  }
});

test("rejects unknown schemaVersion", () => {
  const dir = makeTmp();
  try {
    writeFileSync(join(dir, "pvs.config.json"), JSON.stringify({ schemaVersion: 99, targets: [] }));
    assert.throws(() => loadConfig(dir), /PVS_CONFIG_INVALID|Unsupported schemaVersion/);
  } finally {
    cleanup(dir);
  }
});

test("rejects invalid JSON in config", () => {
  const dir = makeTmp();
  try {
    writeFileSync(join(dir, "pvs.config.json"), "{ not json }");
    assert.throws(() => loadConfig(dir), /PVS_CONFIG_INVALID|Invalid JSON/);
  } finally {
    cleanup(dir);
  }
});

test("rejects target missing file field", () => {
  const dir = makeTmp();
  try {
    writeFileSync(
      join(dir, "pvs.config.json"),
      JSON.stringify({ schemaVersion: 1, targets: [{ type: "generated", template: "x" }] })
    );
    assert.throws(() => loadConfig(dir), { code: "PVS_CONFIG_INVALID" });
  } finally {
    cleanup(dir);
  }
});

test("rejects target with unknown type", () => {
  const dir = makeTmp();
  try {
    writeFileSync(
      join(dir, "pvs.config.json"),
      JSON.stringify({ schemaVersion: 1, targets: [{ file: "x.txt", type: "unknown" }] })
    );
    assert.throws(() => loadConfig(dir), { code: "PVS_CONFIG_INVALID" });
  } finally {
    cleanup(dir);
  }
});

test("rejects unsafe path (path traversal)", () => {
  const dir = makeTmp();
  try {
    writeFileSync(
      join(dir, "pvs.config.json"),
      JSON.stringify({ schemaVersion: 1, targets: [{ file: "../outside.txt", type: "generated", template: "x" }] })
    );
    assert.throws(() => loadConfig(dir), /PVS_UNSAFE_PATH|Unsafe path/);
  } finally {
    cleanup(dir);
  }
});

test("rejects absolute path outside root", () => {
  const dir = makeTmp();
  try {
    writeFileSync(
      join(dir, "pvs.config.json"),
      JSON.stringify({ schemaVersion: 1, targets: [{ file: "/etc/passwd", type: "generated", template: "x" }] })
    );
    assert.throws(() => loadConfig(dir), /PVS_UNSAFE_PATH|Unsafe path/);
  } finally {
    cleanup(dir);
  }
});

test("resolves target _resolved path", () => {
  const dir = makeTmp();
  try {
    writeFileSync(
      join(dir, "pvs.config.json"),
      JSON.stringify({ schemaVersion: 1, targets: [{ file: "src/v.ts", type: "generated", template: "x" }] })
    );
    const config = loadConfig(dir);
    assert.equal(config.targets[0]._resolved, join(dir, "src/v.ts"));
  } finally {
    cleanup(dir);
  }
});
